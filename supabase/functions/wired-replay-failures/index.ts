// wired-replay-failures: finish quiz submissions that wired-submit could not store
// (Fearfully & Wonderfully Wired, W3; spec section 8, model replay-quiz-completion-failures).
// Vercel cron every 30 minutes (api/cron/wired-replay-failures.ts), service role only,
// verify_jwt = true. Oldest first, 10 a run; each goes through the SAME processSubmission as
// a live submission. A row that can never succeed (invalid) is resolved with a note; a row
// still failing is parked after 48 tries (a day of half-hours). Runs whether or not the quiz
// is live (it only ever finds rows wired-submit wrote).

import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';
import { parseSubmission } from '../_shared/wired-submit-core.ts';
import { type Db, pg, processSubmission, WiredBadRequest, WiredUnavailable } from '../_shared/wired-submit-flow.ts';
import { WIRED_CORS, wiredJson } from '../_shared/wired-gate.ts';

const BATCH = 10;
const MAX_TRIES = 48;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: WIRED_CORS });
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(WIRED_CORS);
  const db: Db = { url: Deno.env.get('SUPABASE_URL') ?? '', key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' };
  const pepper = Deno.env.get('WIRED_EMAIL_PEPPER') ?? '';
  const summary = { found: 0, resolved: 0, invalid: 0, still_failing: 0, parked: 0 };
  try {
    const rows = await pg<{ id: string; raw_payload: unknown; retry_count: number }[]>(
      db, `wired_failures?resolved_at=is.null&retry_count=lt.${MAX_TRIES}&select=id,raw_payload,retry_count&order=received_at.asc&limit=${BATCH}`,
    );
    summary.found = rows?.length ?? 0;
    for (const row of rows ?? []) {
      const patch = (fields: Record<string, unknown>) =>
        pg(db, `wired_failures?id=eq.${row.id}&resolved_at=is.null`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fields) });
      const parsed = parseSubmission(row.raw_payload);
      if (!parsed.ok) {
        await patch({ resolved_at: new Date().toISOString(), notes: `invalid, cannot replay: ${parsed.errors.join('; ').slice(0, 400)}` });
        summary.invalid++;
        continue;
      }
      try {
        const out = await processSubmission(db, parsed.value, { pepper });
        await patch({ resolved_at: new Date().toISOString(), last_retry_at: new Date().toISOString(), notes: `replayed: ${out.status}` });
        summary.resolved++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof WiredBadRequest) {
          await patch({ resolved_at: new Date().toISOString(), notes: `invalid, cannot replay: ${message.slice(0, 400)}` });
          summary.invalid++;
          continue;
        }
        const tries = row.retry_count + 1;
        await patch({ retry_count: tries, last_retry_at: new Date().toISOString(), notes: `${err instanceof WiredUnavailable ? 'unavailable' : 'error'}: ${message.slice(0, 400)}` });
        if (tries >= MAX_TRIES) summary.parked++;
        else summary.still_failing++;
      }
    }
    console.log(`wired-replay-failures: ${JSON.stringify(summary)}`);
    return wiredJson(200, summary);
  } catch (err) {
    console.error('wired-replay-failures:', err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: 'replay_failed', ...summary });
  }
});
