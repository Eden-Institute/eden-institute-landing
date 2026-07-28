// Vercel Cron entry point for the end-of-day founder recap.
//
// Schedule: 01:00 UTC daily = 20:00 America/Chicago (CDT, UTC-5).
// During CST (UTC-6) it lands at 19:00 CT. Same one-hour seasonal drift
// api/cron/notify-founder-digest.ts accepts; we don't reschedule twice a year.
//
// Note the date rollover: 01:00 UTC is still the PREVIOUS calendar day in
// Central, which is exactly what we want. The EF derives its own Central-time
// window, so the report covers the day the founder just lived through.
//
// Pattern mirrors api/cron/notify-founder-digest.ts:
//   1. Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}`.
//   2. Forward to the Supabase EF with SUPABASE_SERVICE_ROLE_KEY.
//
// Required env vars (already set for the other crons):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

interface EFResponse {
  sent?: boolean;
  orders?: number;
  gross_cents?: number;
  openers?: number;
  clickers?: number;
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('founder-evening-recap cron: CRON_SECRET env var not set');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — CRON_SECRET missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('founder-evening-recap cron: unauthorized invocation attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('founder-evening-recap cron: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — Supabase env vars missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const efUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/founder-evening-recap`;
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
    console.error('founder-evening-recap cron: EF fetch threw:', message);
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
    `founder-evening-recap cron: EF returned status=${efRes.status} in ${elapsedMs}ms`,
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
