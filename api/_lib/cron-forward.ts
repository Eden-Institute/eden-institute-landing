// The one Vercel-cron -> Supabase Edge Function forwarder. Every file in
// api/cron/ (except notify-founder-digest-retry.ts, which re-exports the digest
// handler) is a thin instance of this. The underscore folder keeps Vercel from
// deploying this file as a route.
//
// Auth chain:
//   1. Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}`; verified here
//      (constant-time) so the route cannot be triggered from arbitrary IPs.
//   2. The EF is called with SUPABASE_SERVICE_ROLE_KEY; every cron-called EF
//      runs at verify_jwt=true and checks the role via _shared/require-service-role.ts,
//      so the anon key will not do.
//
// Required env (Vercel project settings):
//   CRON_SECRET                  random string, must match the value Vercel injects
//   SUPABASE_URL                 (or VITE_SUPABASE_URL) e.g. https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    full service-role JWT from Supabase
//
// Observability: every run logs one `<name>: EF returned status=... in ...ms`
// line with the EF reply. Production logs at
// vercel.com/eden-b55b0b13/eden-institute-landing/logs.

import { safeEqual } from './safe-equal.js';

export interface CronForwardOptions {
  /** Log prefix, e.g. 'drain-lulu-jobs'. */
  name: string;
  /** Edge Function slug under /functions/v1/. */
  efName: string;
  /** Extra JSON fields merged over { source, invoked_at }. */
  body?: Record<string, unknown>;
  /** When the EF reply carries this numeric field > 0, log at error level so it surfaces. */
  stuckAlert?: { field: string; message: (n: number) => string };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });

export function cronHandler(opts: CronForwardOptions): (req: Request) => Promise<Response> {
  return async (req) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error(`${opts.name}: CRON_SECRET env var not set`);
      return json(500, { error: 'Server misconfigured: CRON_SECRET missing' });
    }
    const authHeader = req.headers.get('authorization') ?? '';
    if (!safeEqual(authHeader, `Bearer ${cronSecret}`)) {
      console.warn(`${opts.name}: unauthorized invocation attempt`);
      return json(401, { error: 'Unauthorized' });
    }

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Name the missing variable rather than listing all of them. A combined
    // message cost three diagnosis rounds on the partner-sample endpoint in August.
    if (!supabaseUrl) {
      console.error(`${opts.name}: SUPABASE_URL (and VITE_SUPABASE_URL) missing`);
      return json(500, { error: 'Server misconfigured: SUPABASE_URL missing' });
    }
    if (!serviceRoleKey) {
      console.error(`${opts.name}: SUPABASE_SERVICE_ROLE_KEY missing`);
      return json(500, { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing' });
    }

    const efUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${opts.efName}`;
    const startedAt = Date.now();
    let efRes: Response;
    try {
      efRes = await fetch(efUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, ...JSON_HEADERS },
        body: JSON.stringify({
          source: 'vercel-cron',
          invoked_at: new Date().toISOString(),
          ...(opts.body ?? {}),
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${opts.name}: EF fetch threw:`, message);
      return json(502, { error: `EF fetch failed: ${message}` });
    }

    const elapsedMs = Date.now() - startedAt;
    // A Response body can be read ONCE. Read it as text, then try JSON, so a
    // non-JSON reply (even one labelled application/json) is logged as text
    // instead of throwing 'Body is unusable' on a second read.
    const raw = await efRes.text();
    let efBody: unknown = raw;
    try {
      efBody = JSON.parse(raw);
    } catch {
      // Not JSON: keep the raw text.
    }

    if (opts.stuckAlert && efBody !== null && typeof efBody === 'object') {
      const n = Number((efBody as Record<string, unknown>)[opts.stuckAlert.field] ?? 0);
      if (n > 0) console.error(`${opts.name}: ${opts.stuckAlert.message(n)}`);
    }

    console.log(
      `${opts.name}: EF returned status=${efRes.status} in ${elapsedMs}ms`,
      typeof efBody === 'object' ? JSON.stringify(efBody) : String(efBody),
    );

    return json(efRes.ok ? 200 : 502, {
      cron_status: efRes.ok ? 'ok' : 'ef_error',
      ef_status: efRes.status,
      ef_elapsed_ms: elapsedMs,
      ef_body: efBody,
    });
  };
}
