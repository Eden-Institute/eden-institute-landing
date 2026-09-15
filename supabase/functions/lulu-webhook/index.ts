// supabase/functions/lulu-webhook/index.ts
// Eden's Table: Lulu print-job status webhook.
//
// Lulu POSTs { topic: "PRINT_JOB_STATUS_CHANGED", data: <print job> } every
// time one of our jobs changes status. Auth model mirrors stripe-webhook: no JWT
// (deploy with verify_jwt=false); every request must carry a valid HMAC-SHA256
// over the raw body in Lulu-HMAC-SHA256, keyed with our Lulu client secret.
//
// Idempotency mirrors the Stripe spine: lulu_events ledger (keyed on
// job + status + changed timestamp, fail-open on ledger errors) -> validated
// state transition -> message_log guard. A replayed SHIPPED payload can never
// double-send the shipped email.
//
// Lulu retries a failed delivery 5 times and then DEACTIVATES the webhook, so
// this function returns 200 for anything it can parse, including a job it does
// not recognise; only a bad signature or malformed body is refused.
//
// That includes a failure on OUR side while applying the update (founder
// decision 2026-09-15; before, this returned 500 and let Lulu retry). The event
// stays 'error' in lulu_events with the message, the details are logged and sent
// to Sentry, and the founder gets ONE email per order + event (claimed on
// lulu_events.founder_alerted_at) telling her which order did not update and to
// press Refresh on it in the /founder Orders tab. Refresh re-reads the job from
// Lulu and applies it through the same applyLuluPrintJob, so nothing is lost by
// not asking Lulu to retry.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { LuluPrintJob, verifyLuluSignature } from '../_shared/lulu.ts';
import { applyLuluPrintJob } from '../_shared/lulu-fulfillment.ts';
import { captureException } from '../_shared/sentry.ts';
import { alertFounder } from '../_shared/founder-alert.ts';
import { buildApplyFailureAlert, decideFailureAlert } from '../_shared/lulu-apply-alert.ts';

const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

/**
 * Email the founder that this event did not apply, at most once per event key
 * (job + status + changed time, i.e. per order + event). Never throws.
 */
async function alertApplyFailureOnce(eventKey: string, job: LuluPrintJob, message: string): Promise<'sent' | 'skipped' | 'failed'> {
  try {
    const claimedAt = new Date().toISOString();
    const claim = await adminClient.from('lulu_events')
      .update({ founder_alerted_at: claimedAt })
      .eq('event_key', eventKey)
      .is('founder_alerted_at', null)
      .select('event_key');
    const claimedRows = Array.isArray(claim.data) ? claim.data.length : 0;
    let existing: { founder_alerted_at: string | null } | null | undefined;
    if (!claim.error && claimedRows === 0) {
      const read = await adminClient.from('lulu_events').select('founder_alerted_at').eq('event_key', eventKey).maybeSingle();
      existing = read.error ? undefined : (read.data as { founder_alerted_at: string | null } | null);
    }
    if (claim.error) console.error(`lulu webhook: alert claim for ${eventKey} errored (alerting anyway): ${claim.error.message}`);
    if (decideFailureAlert({ claimError: !!claim.error, claimedRows, existing }) === 'skip_already_alerted') {
      console.log(`lulu webhook: founder already alerted for ${eventKey}`);
      return 'skipped';
    }

    let orderRef: string | null = null;
    try {
      const { data } = await adminClient.from('orders').select('id, order_number')
        .eq('lulu_print_job_id', job.id).maybeSingle();
      orderRef = (data?.order_number as string | null | undefined) ?? null;
    } catch {
      // The same outage that broke the apply may break this read; fall back below.
    }
    if (!orderRef && typeof job.external_id === 'string' && job.external_id) orderRef = job.external_id;

    const { subject, text } = buildApplyFailureAlert({
      orderRef,
      printJobId: job.id,
      statusName: String(job.status?.name ?? ''),
      eventKey,
      error: message,
    });
    const sent = await alertFounder(subject, text, 'lulu-webhook');
    if (!sent && claimedRows > 0) {
      // Release our claim so a later delivery of this event can alert.
      await adminClient.from('lulu_events').update({ founder_alerted_at: null })
        .eq('event_key', eventKey).eq('founder_alerted_at', claimedAt)
        .then(() => {}, () => {});
    }
    return sent ? 'sent' : 'failed';
  } catch (err) {
    console.error(`lulu webhook: founder alert for ${eventKey} threw: ${errText(err)}`);
    return 'failed';
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = (Deno.env.get('LULU_CLIENT_SECRET') ?? '').trim();
  if (!secret) {
    console.error('LULU_CLIENT_SECRET missing; refusing all webhook traffic');
    return new Response('Not configured', { status: 503 });
  }

  const rawBody = await req.text();
  const ok = await verifyLuluSignature(rawBody, req.headers.get('Lulu-HMAC-SHA256'), secret);
  if (!ok) {
    console.error('Lulu webhook signature verification failed');
    return new Response('Invalid signature', { status: 400 });
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const topic = String(payload?.topic ?? '');
  const job = payload?.data as LuluPrintJob | undefined;
  if (topic !== 'PRINT_JOB_STATUS_CHANGED' || !job || typeof job.id !== 'number') {
    // Lulu's "test submission" and any future topic land here. Acknowledge so
    // the webhook is not deactivated; do nothing.
    console.log(`lulu webhook: ignoring topic=${topic || '(none)'} job=${job?.id ?? '(none)'}`);
    return json(200, { received: true, ignored: true });
  }

  const statusName = String(job.status?.name ?? '');
  const eventKey = `${job.id}:${statusName}:${job.status?.changed ?? ''}`;
  console.log(`lulu event: job ${job.id} -> ${statusName} (${eventKey})`);

  // Event-level idempotency gate (fail-open like the Stripe one: a rare
  // duplicate is absorbed downstream by canTransition + message_log).
  try {
    const { error } = await adminClient.from('lulu_events')
      .insert({ event_key: eventKey, print_job_id: job.id, status_name: statusName, status: 'received', payload });
    // deno-lint-ignore no-explicit-any
    if (error && (error as any).code === '23505') {
      const { data } = await adminClient.from('lulu_events').select('status').eq('event_key', eventKey).maybeSingle();
      if (data?.status === 'processed') return json(200, { received: true, duplicate: true });
    } else if (error) {
      throw error;
    }
  } catch (err) {
    console.error('lulu_events ledger write failed (continuing):', err instanceof Error ? err.message : String(err));
  }

  try {
    const result = await applyLuluPrintJob(adminClient, job);
    await adminClient.from('lulu_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('event_key', eventKey);
    return json(200, { received: true, ...result });
  } catch (err) {
    const message = errText(err);
    console.error(
      `lulu webhook: applying ${eventKey} failed (job ${job.id}, status ${statusName}, external_id ${job.external_id ?? 'none'}): ${message}`,
      err instanceof Error && err.stack ? err.stack : '',
    );
    await adminClient.from('lulu_events')
      .update({ status: 'error', error: message.slice(0, 2000) })
      .eq('event_key', eventKey).then(() => {}, () => {});
    await captureException(err, { function: 'lulu-webhook', event_key: eventKey, lulu_job: job.id });
    const founderAlert = await alertApplyFailureOnce(eventKey, job, message);
    // 200, not 500: Lulu deactivates the webhook after 5 failed deliveries. The
    // ledger row stays 'error' (a re-delivery is still allowed through), and the
    // founder recovers the order with Refresh.
    return json(200, { received: true, applied: false, error: message, founder_alert: founderAlert });
  }
});
