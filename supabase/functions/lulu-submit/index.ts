// supabase/functions/lulu-submit/index.ts
//
// Hands queued print-on-demand orders to Lulu.
//
// TWO WAYS IN, one behaviour (same shape as starter-fulfill):
//   POST { order_id }  - the fire-and-forget kick from stripe-webhook, so a paid
//                        order reaches Lulu seconds after payment.
//   POST { }           - the cron drain (api/cron/drain-lulu-jobs), the safety
//                        net for anything the kick missed: a webhook that could
//                        not reach us, a Lulu outage, a missing config value
//                        that has since been set.
//
// The two can race; submitLuluJob claims each row with a compare-and-set before
// any network call, and the loser reports 'skipped'.
//
// AUTH. Service role only. The function bundles the service-role key and can
// place paid print orders, so verify_jwt stays true in config.toml AND the role
// is checked below (the anon key is also a validly signed JWT).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  LULU_JOB_COLUMNS,
  LULU_JOB_MAX_ATTEMPTS,
  LuluJobRow,
  submitLuluJob,
  SubmitResult,
} from '../_shared/lulu-fulfillment.ts';
import { captureException } from '../_shared/sentry.ts';
import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';

const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/** Jobs per drain. Each is one Lulu round trip; a backlog drains on the next tick. */
const DRAIN_BATCH = 10;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!isServiceRoleRequest(req)) return serviceRoleRequired();

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const orderId = typeof body.order_id === 'string' ? body.order_id : null;

  try {
    let rows: LuluJobRow[] = [];
    if (orderId) {
      const { data, error } = await adminClient
        .from('lulu_jobs').select(LULU_JOB_COLUMNS).eq('order_id', orderId).maybeSingle();
      if (error) throw new Error(`job lookup failed: ${error.message}`);
      if (!data) return json(404, { error: 'no Lulu job for that order', order_id: orderId });
      rows = [data as LuluJobRow];
    } else {
      // Oldest first, so a backlog drains in the order people paid.
      const { data, error } = await adminClient
        .from('lulu_jobs').select(LULU_JOB_COLUMNS)
        .in('status', ['pending', 'failed'])
        .lt('attempts', LULU_JOB_MAX_ATTEMPTS)
        .order('created_at', { ascending: true })
        .limit(DRAIN_BATCH);
      if (error) throw new Error(`job scan failed: ${error.message}`);
      rows = (data ?? []) as LuluJobRow[];
    }

    const results: SubmitResult[] = [];
    for (const row of rows) results.push(await submitLuluJob(adminClient, row));

    // A row that has burned every attempt is invisible to the drain from then
    // on. Count it, loudly, or "nothing to do" and "cannot do anything" look
    // identical, which is how two scheduled tasks sat dead for three weeks in
    // August 2026.
    const { count: stuck } = await adminClient
      .from('lulu_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('attempts', LULU_JOB_MAX_ATTEMPTS);
    if (stuck && stuck > 0) {
      console.error(
        `${stuck} Lulu job(s) have exhausted ${LULU_JOB_MAX_ATTEMPTS} attempts and will NOT be retried ` +
          `automatically. See lulu_jobs.last_error, fix the cause, then Resubmit from /founder.`,
      );
    }

    const submitted = results.filter((r) => r.status === 'submitted').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    console.log(`lulu-submit: processed=${results.length} submitted=${submitted} failed=${failed} stuck=${stuck ?? 0}`);
    return json(200, { processed: results.length, submitted, failed, stuck: stuck ?? 0, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('lulu-submit error:', message);
    await captureException(err instanceof Error ? err : new Error(message), {
      function: 'lulu-submit',
      order_id: orderId ?? '(drain)',
    });
    return json(500, { error: message });
  }
});
