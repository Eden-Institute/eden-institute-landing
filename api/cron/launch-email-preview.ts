// Vercel Cron entry point for the founder's 24-hour launch-email preview.
//
// Schedule: 15:00 UTC daily = 10:00 America/Chicago (CDT). The launch series
// sends at 15:00 UTC, so a run at 15:00 UTC finds the next day's email sitting
// almost exactly 24 hours out. The edge function widens that to an 18-30 hour
// window so a drifting cron, or a send hour that shifts with DST, can never
// skip an email entirely.
//
// The function is idempotent (sequence_position is the primary key of
// launch_email_previews), so an extra run costs nothing.
//
// Pattern mirrors api/cron/notify-founder-digest.ts.
//
// Required env vars (already set for the other crons):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

interface EFResponse {
  mode?: string;
  founding?: boolean;
  considered?: number[];
  results?: { position: number; sent: boolean; subject?: string; error?: string }[];
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('launch-email-preview cron: CRON_SECRET env var not set');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — CRON_SECRET missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('launch-email-preview cron: unauthorized invocation attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('launch-email-preview cron: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — Supabase env vars missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const efUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/launch-email-preview`;
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
    console.error('launch-email-preview cron: EF fetch threw:', message);
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
    `launch-email-preview cron: EF returned status=${efRes.status} in ${elapsedMs}ms`,
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
