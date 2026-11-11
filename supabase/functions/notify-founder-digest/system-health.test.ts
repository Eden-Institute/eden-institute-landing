// deno test --no-lock -A supabase/functions/notify-founder-digest/system-health.test.ts
//
// The digest's System health block: what passes, what fails, and that a check
// which could not read its data never counts as a pass. No network.

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  evaluateSystemHealth,
  hasHealthProblem,
  systemHealthHtml,
  systemHealthTextLines,
  type SystemHealthInput,
} from './system-health.ts';

const zeroQueues = () => ({
  nurture_email_queue: 0,
  magnet_email_queue: 0,
  launch_email_queue: 0,
  buyer_email_queue: 0,
  followup_email_queue: 0,
  founding_family_queue: 0,
});

function healthy(): SystemHealthInput {
  return {
    recapStatus: 'sent',
    lastTrendsSent: '2026-10-30',
    digestFailed30d: 0,
    failedByQueue: zeroQueues(),
    oldestFailed: null,
    stuckByQueue: zeroQueues(),
    stripeProblems: 0,
    luluProblems: 0,
    starterProblems: 0,
    ga4ByStatus: { sent: 2, skipped_internal: 1, skipped_declined: 1 },
    ga4SecretSet: true,
    sampleLinkSpikes: [],
  };
}

const byKey = (input: SystemHealthInput) =>
  Object.fromEntries(evaluateSystemHealth(input, '2026-10-30', '2026-10-31').map((c) => [c.key, c]));

Deno.test('all healthy: every check passes and the block is one green line', () => {
  const checks = evaluateSystemHealth(healthy(), '2026-10-30', '2026-10-31');
  assertEquals(checks.length, 10);
  assert(checks.every((c) => c.ok === true));
  assertEquals(hasHealthProblem(checks), false);
  assertStringIncludes(systemHealthHtml(checks), 'All 10 checks passed');
  assertEquals(systemHealthTextLines(checks), ['System health: all 10 checks passed.']);
});

Deno.test('the October 2026 state: 74 old failed emails and no GA4 key are both caught', () => {
  const input = healthy();
  input.failedByQueue = { ...zeroQueues(), nurture_email_queue: 14, magnet_email_queue: 16, launch_email_queue: 44 };
  input.oldestFailed = '2026-05-06T08:44:51.574+00:00';
  input.ga4ByStatus = { skipped_no_secret: 1, skipped_internal: 2 };
  const c = byKey(input);
  assertEquals(c.failed_emails.ok, false);
  assertStringIncludes(c.failed_emails.detail, '74 automated emails failed and were never closed');
  assertStringIncludes(c.failed_emails.detail, 'quiz emails 14, free-week emails 16, launch emails 44, oldest 2026-05-06');
  assertEquals(c.ga4.ok, false);
  assertStringIncludes(c.ga4.detail, '1 sale in the last 7 days did not reach Google Analytics (GA4 key missing 1)');
  const checks = Object.values(c);
  assert(hasHealthProblem(checks));
  assertStringIncludes(systemHealthHtml(checks), '8 of 10 checks passed');
});

Deno.test('a read that failed is "could not check", never a pass', () => {
  const input = healthy();
  input.failedByQueue = { ...zeroQueues(), launch_email_queue: null };
  input.stripeProblems = null;
  input.recapUnread = true;
  input.ga4ByStatus = null;
  const c = byKey(input);
  assertEquals(c.failed_emails.ok, null);
  assertEquals(c.stripe.ok, null);
  assertEquals(c.recap.ok, null);
  assertEquals(c.ga4.ok, null);
  const lines = systemHealthTextLines(Object.values(c));
  assertStringIncludes(lines[0], '4 problems');
  assert(lines.some((l) => l.startsWith('  COULD NOT CHECK: Stripe payment notices')));
});

Deno.test('recap missing, trends late, a failed digest, stuck mail, money rails', () => {
  const input = healthy();
  input.recapStatus = null;
  input.lastTrendsSent = '2026-10-16';
  input.digestFailed30d = 1;
  input.stuckByQueue = { ...zeroQueues(), followup_email_queue: 2 };
  input.stripeProblems = 1;
  input.luluProblems = 3;
  input.starterProblems = 1;
  const c = byKey(input);
  assertEquals(c.recap.detail, 'Evening recap for 2026-10-30 did not go out (no run recorded).');
  assertEquals(c.trends.ok, false);
  assertEquals(c.digest.detail, '1 daily digest in the last 30 days failed and never went out.');
  assertEquals(c.stuck_emails.detail, '2 emails are more than a day past their send time (follow-up emails 2).');
  assertEquals(c.stripe.detail, '1 Stripe payment notice failed or stuck. A customer may be waiting.');
  assertEquals(c.lulu.detail, '3 lulu print orders failed or stuck. A customer may be waiting.');
  assertEquals(c.starter.detail, '1 Starter Unit download failed or stuck. A customer may be waiting.');
});

Deno.test('weekly trends: a Friday digest a few seconds before that morning\'s run still passes', () => {
  const input = healthy();
  input.lastTrendsSent = '2026-10-23';
  assertEquals(byKey(input).trends.ok, true); // 8 days before 2026-10-31
  input.lastTrendsSent = '2026-10-22';
  assertEquals(byKey(input).trends.ok, false);
});

Deno.test('deliberate GA4 skips are not problems; never-reported and refused are', () => {
  const input = healthy();
  input.ga4ByStatus = { skipped_test: 3, skipped_unmatched: 1, skipped_not_subscription: 2 };
  assertEquals(byKey(input).ga4.ok, true);
  input.ga4ByStatus = { none: 1, failed: 2 };
  assertStringIncludes(byKey(input).ga4.detail, 'never reported 1, GA4 refused 2');
});

Deno.test('ESA sales (skipped_esa) are an on-purpose gap, not a lost sale (punch #450)', () => {
  // The November 2026 state once labelled: the 2 Shaffer ESA invoices + one buyer who clicked Decline.
  const input = healthy();
  input.ga4ByStatus = { skipped_esa: 2, skipped_declined: 1 };
  assertEquals(byKey(input).ga4.ok, true);
  // Before the label the same rows read as NULL, which the check rightly called "never reported".
  input.ga4ByStatus = { none: 2, skipped_declined: 1 };
  assertStringIncludes(byKey(input).ga4.detail, '2 sales in the last 7 days did not reach Google Analytics (never reported 2)');
});

Deno.test('a missing GA4 key fails the check even before any sale is lost', () => {
  const input = healthy();
  input.ga4SecretSet = false;
  input.ga4ByStatus = {};
  const c = byKey(input);
  assertEquals(c.ga4.ok, false);
  assertStringIncludes(c.ga4.detail, 'GA4_MP_API_SECRET) is not set');
});

Deno.test('detail text is escaped in the HTML block', () => {
  const html = systemHealthHtml([{ key: 'x', ok: false, detail: '<b>&' }]);
  assertStringIncludes(html, '&lt;b&gt;&amp;');
});

// ── Lulu after submit (L4) and print files (L5), 2026-11-11 ──

Deno.test('L4/L5: the Lulu printer and print-file checks are skipped when not supplied, so older inputs still read 10', () => {
  const c = byKey(healthy());
  assertEquals('lulu_printer' in c, false);
  assertEquals('lulu_files' in c, false);
});

Deno.test('L4/L5: all clear reads as two more passing checks', () => {
  const input = { ...healthy(), luluUnpaid: 0, luluOverdue: 0, luluFiles: { checked: 18, bad: [], unreachable: [] } };
  const checks = evaluateSystemHealth(input, '2026-10-30', '2026-10-31');
  assertEquals(checks.length, 12);
  assert(checks.every((x) => x.ok === true));
  const c = byKey(input);
  assertStringIncludes(c.lulu_printer.detail, 'none on hold, none overdue');
  assertStringIncludes(c.lulu_files.detail, 'all 18 answer as PDFs');
  assertStringIncludes(systemHealthHtml(checks), 'Lulu (orders and print files)');
});

Deno.test('L4: an order held UNPAID at Lulu, and one that never shipped, are both named', () => {
  const c = byKey({ ...healthy(), luluUnpaid: 1, luluOverdue: 2 });
  assertEquals(c.lulu_printer.ok, false);
  assertStringIncludes(c.lulu_printer.detail, '1 print order on hold at Lulu as UNPAID');
  assertStringIncludes(c.lulu_printer.detail, 'Lulu will not print it until the payment is fixed');
  assertStringIncludes(c.lulu_printer.detail, '2 print orders sent to Lulu more than 14 days ago and still not shipped');
  const unread = byKey({ ...healthy(), luluUnpaid: null, luluOverdue: 0 });
  assertEquals(unread.lulu_printer.ok, null);
});

Deno.test('L5: a dead print file is a problem; a silent host is "could not check"; an unreadable table too', () => {
  const dead = byKey({ ...healthy(), luluFiles: { checked: 18, bad: ["Eden's Table Sprouts: Teacher's Guide (cover): HTTP 404"], unreachable: [] } });
  assertEquals(dead.lulu_files.ok, false);
  assertStringIncludes(dead.lulu_files.detail, '1 Lulu print file would not download as a PDF');
  assertStringIncludes(dead.lulu_files.detail, 'HTTP 404');
  const quiet = byKey({ ...healthy(), luluFiles: { checked: 18, bad: [], unreachable: ['x (cover): no answer (TimeoutError)'] } });
  assertEquals(quiet.lulu_files.ok, null);
  assertEquals(byKey({ ...healthy(), luluFiles: null }).lulu_files.ok, null);
  const many = byKey({ ...healthy(), luluFiles: { checked: 18, bad: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], unreachable: [] } });
  assertStringIncludes(many.lulu_files.detail, 'and 2 more');
});
