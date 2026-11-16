import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  checkBroadcastHtml,
  checkScheduledAt,
  isBroadcastAudience,
  isBroadcastSegmentName,
  needsRefresh,
  parseResendTime,
  planStage,
  dueForRefresh,
  FINAL_REFRESH_MS,
  OPTOUT_PUSH_PER_RUN,
  optOutPushOutcome,
  optOutsToPush,
  refreshAlertKey,
  refreshAlertText,
  refreshProblemAlerts,
  REFRESH_EVERY_MS,
} from './broadcast-stage-plan.ts';

const FOOT = 'Rooted in Faith Ventures LLC <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a>';

Deno.test('planStage: adds the new, removes the departed, keeps the settled', () => {
  const plan = planStage(
    ['b@x.com', 'A@x.com', 'c@x.com', 'd@x.com'],
    [
      { email: 'a@x.com', status: 'added' },
      { email: 'c@x.com', status: 'failed' },
      { email: 'd@x.com', status: 'absent' },
      { email: 'gone@x.com', status: 'created' },
      { email: 'gone2@x.com', status: 'absent' },
    ],
  );
  assertEquals(plan.toAdd, ['b@x.com', 'c@x.com']);
  assertEquals(plan.toRemove, ['gone@x.com']);
  assertEquals(plan.toForget, ['gone2@x.com']);
  assertEquals(plan.settled, 2);
});

Deno.test('planStage: a settled segment has nothing to do', () => {
  const plan = planStage(['a@x.com'], [{ email: 'a@x.com', status: 'added' }]);
  assertEquals([plan.toAdd.length, plan.toRemove.length, plan.toForget.length, plan.settled], [0, 0, 0, 1]);
});

Deno.test('segment names: only "Broadcast: ..." is writable', () => {
  assertEquals(isBroadcastSegmentName('Broadcast: Oct 30 used it (Sprouts)'), true);
  assertEquals(isBroadcastSegmentName('Sprouts families'), false);
  assertEquals(isBroadcastSegmentName('Broadcast: '), false);
  assertEquals(isBroadcastSegmentName('Broadcast: <script>'), false);
});

Deno.test('audiences: known names only', () => {
  assertEquals(isBroadcastAudience('catchup_unused'), true);
  assertEquals(isBroadcastAudience('everyone'), true);
  assertEquals(isBroadcastAudience('everybody'), false);
});

Deno.test('checkBroadcastHtml: guards', () => {
  assertEquals(checkBroadcastHtml(`<p>Hi</p>${FOOT}`), null);
  assertEquals(checkBroadcastHtml('<p>Hi</p>Rooted in Faith Ventures LLC')?.includes('RESEND_UNSUBSCRIBE_URL'), true);
  assertEquals(checkBroadcastHtml(`<a href="{{UNSUB_URL}}">x</a>${FOOT}`)?.includes('UNSUB_URL'), true);
  assertEquals(checkBroadcastHtml(`<p>\${name}</p>${FOOT}`)?.includes('unrendered'), true);
  assertEquals(checkBroadcastHtml('<a href="{{{RESEND_UNSUBSCRIBE_URL}}}">x</a>')?.includes('postal'), true);
  assertEquals(checkBroadcastHtml(`<p>a — b</p>${FOOT}`)?.includes('em dash'), true);
  assertEquals(checkBroadcastHtml(`<p>a &mdash; b</p>${FOOT}`)?.includes('em dash'), true);
  assertEquals(checkBroadcastHtml(''), 'html required');
});

Deno.test('checkScheduledAt: window', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  assertEquals(checkScheduledAt('2026-10-31T00:00:00Z', now), { iso: '2026-10-31T00:00:00.000Z' });
  assertEquals('error' in checkScheduledAt('2026-10-29T12:05:00Z', now), true);
  assertEquals('error' in checkScheduledAt('2026-12-15T00:00:00Z', now), true);
  assertEquals('error' in checkScheduledAt('next friday', now), true);
});

Deno.test('parseResendTime: ISO and the Postgres-style stamps Resend returns', () => {
  const iso = Date.parse('2026-10-31T00:00:00Z');
  assertEquals(parseResendTime('2026-10-31T00:00:00.000Z'), iso);
  assertEquals(parseResendTime('2026-10-31 00:00:00+00'), iso);
  assertEquals(parseResendTime('2026-10-31 00:00:00.000+00'), iso);
  assertEquals(parseResendTime('2026-10-31 00:00:00+00:00'), iso);
  assertEquals(Number.isNaN(parseResendTime(null)), true);
  assertEquals(Number.isNaN(parseResendTime('')), true);
});

Deno.test('dueForRefresh: scheduled, ahead, inside the window only', () => {
  const now = Date.parse('2026-10-30T00:00:00Z');
  const list = [
    { id: 'a', status: 'scheduled', scheduled_at: '2026-10-31 00:00:00+00' }, // 24h ahead: due
    { id: 'b', status: 'scheduled', scheduled_at: '2026-11-07 01:00:00+00' }, // 8 days ahead: not yet
    { id: 'c', status: 'draft', scheduled_at: null },
    { id: 'd', status: 'scheduled', scheduled_at: '2026-10-29 23:00:00+00' }, // already past
    { id: 'e', status: 'sent', scheduled_at: '2026-10-30 10:00:00+00' },
  ];
  assertEquals(dueForRefresh(list, now).map((b) => b.id), ['a']);
});

Deno.test('needsRefresh: never, stale, fresh', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  assertEquals(needsRefresh(null, now), true);
  assertEquals(needsRefresh('2026-10-30T05:00:00Z', now), true);
  assertEquals(needsRefresh('2026-10-30T08:00:00Z', now), false);
});

// ── 2026-11-16, Lane 2 area 7 B1/B2 (founder tap "Yes, build + ship both") ──────────────────

const H = 60 * 60 * 1000;
// A Friday 7 PM CST send = Saturday 01:00 UTC.
const SEND = Date.parse('2026-11-21T01:00:00Z');

Deno.test('needsRefresh: without a send time the 6-hour rule is unchanged', () => {
  const now = SEND - 55 * 60 * 1000; // the 00:05 run
  assertEquals(needsRefresh(new Date(now - 5 * H).toISOString(), now), false);
  assertEquals(needsRefresh(new Date(now - 6 * H).toISOString(), now), true);
  assertEquals(needsRefresh(null, now), true);
});

Deno.test('needsRefresh: one more refresh inside the last 90 minutes when the last one came before that window', () => {
  const now = SEND - 55 * 60 * 1000; // 00:05 UTC, 55 min before a 01:00 send
  // Nov 13 shape: last refresh 20:05 UTC, 5 h before the send -> refresh again now.
  assertEquals(needsRefresh(new Date(SEND - 5 * H + 5 * 60 * 1000).toISOString(), now, REFRESH_EVERY_MS, SEND), true);
  // Already refreshed inside the final window (e.g. 23:40 UTC) -> no second one.
  assertEquals(needsRefresh(new Date(SEND - 80 * 60 * 1000).toISOString(), now, REFRESH_EVERY_MS, SEND), false);
});

Deno.test('needsRefresh: the final window does not fire early, or after the send', () => {
  const last = new Date(SEND - 5 * H).toISOString();
  // 23:05 UTC is 115 min out: outside the 90-minute window, and refreshed 3 h ago -> no.
  assertEquals(needsRefresh(last, SEND - 115 * 60 * 1000, REFRESH_EVERY_MS, SEND), false);
  // After the send time -> no final-window refresh.
  assertEquals(needsRefresh(new Date(SEND - 2 * H).toISOString(), SEND + 60 * 1000, REFRESH_EVERY_MS, SEND), false);
  // An unreadable send time (NaN) falls back to the 6-hour rule.
  assertEquals(needsRefresh(new Date(SEND - 5 * H).toISOString(), SEND - 30 * 60 * 1000, REFRESH_EVERY_MS, Number.NaN), false);
  assertEquals(FINAL_REFRESH_MS, 90 * 60 * 1000);
});

Deno.test('optOutsToPush: global + homeschool opt-outs, lowercased, minus settled and test addresses', () => {
  const due = optOutsToPush(
    ['Mom@Example.com ', 'left@x.com', 'bot@example.test', ''],
    ['list@x.com', 'mom@example.com'],
    ['LEFT@x.com'],
  );
  assertEquals(due, ['list@x.com', 'mom@example.com']);
});

Deno.test('optOutsToPush: an earlier failed push is retried (failed is not settled)', () => {
  assertEquals(optOutsToPush(['a@x.com'], [], []), ['a@x.com']);
  assertEquals(OPTOUT_PUSH_PER_RUN > 0 && OPTOUT_PUSH_PER_RUN <= 50, true);
});

Deno.test('optOutPushOutcome: 2xx ok; 404 and 422 absent (Resend can never mail them); the rest failed', () => {
  assertEquals(optOutPushOutcome(200), 'ok');
  assertEquals(optOutPushOutcome(204), 'ok');
  assertEquals(optOutPushOutcome(404), 'absent');
  assertEquals(optOutPushOutcome(422), 'absent');
  assertEquals(optOutPushOutcome(429), 'failed');
  assertEquals(optOutPushOutcome(500), 'failed');
  assertEquals(optOutPushOutcome(401), 'failed');
  assertEquals(optOutPushOutcome(0), 'failed'); // no answer (network / timeout)
});

Deno.test('refreshProblemAlerts: a refresh problem alerts only inside 8 hours of the send', () => {
  assertEquals(refreshProblemAlerts(SEND, SEND - 9 * H), false);
  assertEquals(refreshProblemAlerts(SEND, SEND - 8 * H), true);
  assertEquals(refreshProblemAlerts(SEND, SEND - 1 * H), true);
  assertEquals(refreshProblemAlerts(Number.NaN, SEND), false);
});

Deno.test('refreshAlertKey: one key per UTC day and 6-hour block', () => {
  assertEquals(refreshAlertKey(Date.parse('2026-11-20T00:05:00Z')), 'broadcast-stage/refresh-alert/2026-11-20/0');
  assertEquals(refreshAlertKey(Date.parse('2026-11-20T05:05:00Z')), 'broadcast-stage/refresh-alert/2026-11-20/0');
  assertEquals(refreshAlertKey(Date.parse('2026-11-20T06:05:00Z')), 'broadcast-stage/refresh-alert/2026-11-20/1');
  assertEquals(refreshAlertKey(Date.parse('2026-11-20T23:05:00Z')), 'broadcast-stage/refresh-alert/2026-11-20/3');
  assertEquals(refreshAlertKey(Date.parse('2026-11-21T00:05:00Z')), 'broadcast-stage/refresh-alert/2026-11-21/0');
});

Deno.test('refreshAlertText: lists every problem, plain words, no em or en dashes', () => {
  const t = refreshAlertText(['"Nov 20 list: Thanksgiving thank-you": its list could not be refreshed']);
  assertEquals(t.includes('- "Nov 20 list: Thanksgiving thank-you": its list could not be refreshed'), true);
  assertEquals(t.includes('check the Broadcast refresh'), true);
  assertEquals(/[–—]/.test(t), false);
});
