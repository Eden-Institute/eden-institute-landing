// deno test supabase/functions/_shared/webhook-guards.test.ts
//
// The 2026-11-06 checkout audit: an order email that failed and was never re-sent is
// detected, so the webhook can ask Stripe to redeliver the event.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { unsentOrderEmails } from './webhook-guards.ts';

const row = (template_key: string, status: string, channel = 'email', triggered_by_status = 'ready_to_fulfill') =>
  ({ channel, template_key, triggered_by_status, status });

Deno.test('a sent confirmation leaves nothing to retry', () => {
  assertEquals(unsentOrderEmails([row('order_confirmation', 'sent')]), []);
});

Deno.test('a failed confirmation with no later send is reported', () => {
  assertEquals(unsentOrderEmails([row('order_confirmation', 'failed')]), ['order_confirmation']);
});

Deno.test('a failure followed by a successful re-send is not reported', () => {
  assertEquals(unsentOrderEmails([row('order_confirmation', 'failed'), row('order_confirmation', 'sent')]), []);
});

Deno.test('repeated failures report the template once', () => {
  assertEquals(
    unsentOrderEmails([row('order_confirmation', 'failed'), row('order_confirmation', 'failed')]),
    ['order_confirmation'],
  );
});

Deno.test('a failed SMS never holds the webhook', () => {
  assertEquals(unsentOrderEmails([row('order_confirmation', 'sent'), row('order_confirmation_sms', 'failed', 'sms')]), []);
});

Deno.test('a send for a different status does not cover a failure', () => {
  assertEquals(
    unsentOrderEmails([row('order_confirmation', 'failed'), row('order_confirmation', 'sent', 'email', 'paid')]),
    ['order_confirmation'],
  );
});

Deno.test('no rows at all is nothing to retry', () => {
  assertEquals(unsentOrderEmails([]), []);
});
