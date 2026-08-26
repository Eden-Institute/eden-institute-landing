// supabase/functions/starter-fulfill/index.ts
//
// Delivers queued Starter Unit purchases: stamp the two PDFs with the buyer's
// name and email, store them privately, sign 7-day URLs, send the email.
//
// TWO WAYS IN, one behaviour:
//   POST { session_id }  - the fire-and-forget kick from stripe-webhook, so a
//                          buyer's files land seconds after payment.
//   POST { }             - the cron drain (Vercel cron, see api/cron/), which is
//                          the safety net for anything the kick missed: a webhook
//                          that could not reach us, an isolate that died
//                          mid-stamp, a Resend outage.
//
// The two can race. They do not conflict, because fulfilStarterDelivery claims
// each row with a compare-and-set on status before doing any work, and the loser
// reports 'skipped' rather than sending a second copy.
//
// AUTH. Service role only. The function bundles the service-role key and mints
// signed URLs for paid content, so a public caller could enumerate deliveries.
// verify_jwt stays true in config.toml AND the role claim is checked below, the
// same belt-and-braces the constitution-pdf function uses for the paid guide.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DeliveryRow, fulfilStarterDelivery } from '../_shared/starter-fulfillment.ts';
import { captureException } from '../_shared/sentry.ts';
import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/**
 * How many deliveries one drain handles.
 *
 * Each is roughly 20MB of PDF work plus two uploads and a send, so this is a
 * wall-clock bound, not a throughput target. Anything left over is picked up by
 * the next tick; the count is logged so a backlog is visible rather than silent.
 */
const DRAIN_BATCH = 5;

/** Give up automatic retries after this many, so a poison row cannot loop forever. */
const MAX_ATTEMPTS = 5;

const DELIVERY_COLUMNS =
  'id, stripe_checkout_session_id, order_id, email, purchaser_name, status, attempts, sent_at, tg_object_path, nb_object_path, download_token';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Look up the credit code that belongs with this delivery, if one was issued. */
async function creditCodeFor(sessionId: string): Promise<string | null> {
  const { data, error } = await adminClient
    .from('starter_credits').select('code')
    .eq('stripe_checkout_session_id', sessionId).maybeSingle();
  if (error) {
    // A delivery without its code is still worth sending: the buyer gets their
    // files, and the code can be re-sent by hand. Silence would be worse.
    console.error(`[${sessionId}] credit lookup failed, delivering without a code: ${error.message}`);
    return null;
  }
  return data?.code ?? null;
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  // Service role only. verify_jwt=true blocks unsigned callers, but the project's
  // ANON key is also a validly-signed JWT and ships in the client bundle, so the
  // gateway alone is not enough.
  //
  // Uses the shared guard rather than a local check on purpose: new-format
  // Supabase keys (`sb_secret_...`) are opaque strings, not JWTs, so a
  // claim-decoding check rejects a legitimate service-role caller. That exact bug
  // silently stopped Deep-Dive Guide PDFs reaching paying customers in July 2026.
  if (!isServiceRoleRequest(req)) return serviceRoleRequired();

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const sessionId = typeof body.session_id === 'string' ? body.session_id : null;

  try {
    let rows: DeliveryRow[] = [];

    if (sessionId) {
      const { data, error } = await adminClient
        .from('starter_deliveries').select(DELIVERY_COLUMNS)
        .eq('stripe_checkout_session_id', sessionId).maybeSingle();
      if (error) throw new Error(`delivery lookup failed: ${error.message}`);
      if (!data) return json(404, { error: 'no delivery for that session', session_id: sessionId });
      rows = [data as DeliveryRow];
    } else {
      // Oldest first, so a backlog drains in the order people paid.
      const { data, error } = await adminClient
        .from('starter_deliveries').select(DELIVERY_COLUMNS)
        .in('status', ['pending', 'failed'])
        .lt('attempts', MAX_ATTEMPTS)
        .order('created_at', { ascending: true })
        .limit(DRAIN_BATCH);
      if (error) throw new Error(`delivery scan failed: ${error.message}`);
      rows = (data ?? []) as DeliveryRow[];
    }

    const results: Array<{ session_id: string; status: string; detail?: string }> = [];
    for (const row of rows) {
      const code = await creditCodeFor(row.stripe_checkout_session_id);
      const out = await fulfilStarterDelivery(adminClient, row, code);
      results.push({ session_id: row.stripe_checkout_session_id, ...out });
    }

    // Surface a stuck backlog rather than letting it sit. A row that has burned
    // MAX_ATTEMPTS is invisible to the drain from then on, which is exactly the
    // failure shape that let two scheduled tasks look healthy for three weeks in
    // August: "nothing to do" and "cannot do anything" are indistinguishable
    // unless someone counts.
    const { count: stuck } = await adminClient
      .from('starter_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('attempts', MAX_ATTEMPTS);
    if (stuck && stuck > 0) {
      console.error(
        `${stuck} starter delivery/deliveries have exhausted ${MAX_ATTEMPTS} attempts and will NOT be ` +
          `retried automatically. Query starter_delivery_attempts by session id to see which stage fails.`,
      );
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    console.log(`starter-fulfill: processed=${results.length} sent=${sent} failed=${failed} stuck=${stuck ?? 0}`);

    return json(200, { processed: results.length, sent, failed, stuck: stuck ?? 0, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('starter-fulfill error:', message);
    await captureException(err instanceof Error ? err : new Error(message), {
      function: 'starter-fulfill',
      session_id: sessionId ?? '(drain)',
    });
    return json(500, { error: message });
  }
});
