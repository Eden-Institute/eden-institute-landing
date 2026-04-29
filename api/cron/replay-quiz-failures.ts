// PR (2026-04-29) v2 — Vercel Cron entry point that drains quiz_completion_failures
// via the replay-quiz-completion-failures Supabase Edge Function. Runs every 30
// min per vercel.json crons[1].schedule.
//
// Architecture: mirrors api/cron/drain-nurture-queue.ts (Lock #48 consumer for the
// nurture-email queue). Same auth chain, same env vars, same edge runtime.
//
// v2 hotfix (2026-04-29): Authorization header now sends service-role key
// (matches nurture-emails / drain-nurture-queue exactly). v1 was sending
// CRON_SECRET in Authorization which the Supabase EF replay-quiz-completion-
// failures v2 doesn't accept (it requires service-role JWT, same as
// nurture-emails).
//
// Why 30 minutes (vs nurture's 15): quiz-completion failures are recoverable but
// not time-sensitive in the same way email drips are. A 30-min recovery window is
// fast enough that the visitor's nurture sequence (which fires off the same email
// the EF gives them on success) catches up cleanly. Tunable in vercel.json.
//
// Auth chain:
//   1. Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}` on cron-
//      triggered requests. We verify that header matches the env var. This
//      prevents arbitrary POSTs from draining the queue.
//   2. We then call the Supabase EF with the service-role key in Authorization.
//      Same posture as the existing drain-nurture-queue cron.
//
// Required env vars (set in Vercel project settings):
//   CRON_SECRET                  random string, must match Vercel injection
//   SUPABASE_URL                 e.g. https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    full service-role JWT from Supabase
//
// Observability: returns the EF response JSON to Vercel function logs.
// Production logs visible at vercel.com/eden-b55b0b13/eden-institute-landing/logs.

interface EFResponse {
  ok?: boolean;
  processed?: number;
  resolved?: number;
  still_failing?: number;
  errors?: string[];
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  // 1. Auth: verify CRON_SECRET
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('replay-quiz-failures: CRON_SECRET env var not set');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — CRON_SECRET missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('replay-quiz-failures: unauthorized invocation attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Validate Supabase env
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('replay-quiz-failures: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — Supabase env vars missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Invoke the EF — v2 forwards service-role key in Authorization (matches
  // nurture-emails / drain-nurture-queue auth posture).
  const efUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/replay-quiz-completion-failures`;
  const startedAt = Date.now();
  let efRes: Response;
  try {
    efRes = await fetch(efUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'vercel-cron', invoked_at: new Date().toISOString() }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('replay-quiz-failures: EF fetch threw:', message);
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
    `replay-quiz-failures: EF returned status=${efRes.status} in ${elapsedMs}ms`,
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

// Vercel Edge Runtime config — keeps cold start small (no Node deps needed).
export const config = { runtime: 'edge' };
