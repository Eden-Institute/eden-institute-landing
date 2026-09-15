// deno test supabase/functions/_shared/lulu-apply-alert.test.ts

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildApplyFailureAlert, decideFailureAlert } from './lulu-apply-alert.ts';

Deno.test('the first delivery that claims the event sends the alert', () => {
  assertEquals(decideFailureAlert({ claimError: false, claimedRows: 1 }), 'send');
});

Deno.test('a repeat delivery of an event already alerted is skipped', () => {
  assertEquals(
    decideFailureAlert({ claimError: false, claimedRows: 0, existing: { founder_alerted_at: '2026-09-16T10:00:00Z' } }),
    'skip_already_alerted',
  );
});

Deno.test('no ledger row (the insert failed open) still alerts', () => {
  assertEquals(decideFailureAlert({ claimError: false, claimedRows: 0, existing: null }), 'send');
});

Deno.test('a claim that errors, or a row that cannot be read, still alerts', () => {
  assertEquals(decideFailureAlert({ claimError: true, claimedRows: 0 }), 'send');
  assertEquals(decideFailureAlert({ claimError: false, claimedRows: 0, existing: undefined }), 'send');
  assertEquals(decideFailureAlert({ claimError: false, claimedRows: 0, existing: { founder_alerted_at: null } }), 'send');
});

Deno.test('the alert names the order, the status and the Refresh step, with no em dashes', () => {
  const a = buildApplyFailureAlert({
    orderRef: 'ET-1042',
    printJobId: 98765,
    statusName: 'SHIPPED',
    eventKey: '98765:SHIPPED:2026-09-16T10:00:00Z',
    error: 'update orders: gateway timeout',
  });
  assertEquals(a.subject, 'Lulu update did not save for order ET-1042');
  assert(a.text.includes('press Refresh on order ET-1042'));
  assert(a.text.includes('SHIPPED'));
  assert(a.text.includes('gateway timeout'));
  assert(!a.text.includes('\u2014') && !a.subject.includes('\u2014'));
});

Deno.test('with no matching order the alert falls back to the Lulu job id', () => {
  const a = buildApplyFailureAlert({ orderRef: null, printJobId: 5, statusName: '', eventKey: 'k', error: 'x' });
  assertEquals(a.subject, 'Lulu update did not save for order Lulu print job 5');
});
