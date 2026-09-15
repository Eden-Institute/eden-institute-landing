// deno test supabase/functions/_shared/broadcast-resume.test.ts
//
// Resuming an interrupted cohort send: recipient diffing against the send log,
// stale claims, same-message checks, and what the dashboard is told.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  broadcastMatches,
  isStaleClaim,
  planResume,
  type SendLogRow,
  STALE_CLAIM_MS,
  summarizeSend,
} from './broadcast-resume.ts';

const NOW = new Date('2026-09-16T15:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const r = (n: number, email = `buyer${n}@example.com`) => ({ order_id: `o${n}`, customer_email: email, shipping_name: null });
const sent = (n: number): SendLogRow => ({ order_id: `o${n}`, recipient_email: `buyer${n}@example.com`, status: 'sent', claimed_at: ago(60_000) });
const sending = (n: number, age: number): SendLogRow => ({ order_id: `o${n}`, recipient_email: `buyer${n}@example.com`, status: 'sending', claimed_at: ago(age) });

Deno.test('a fresh message sends to everyone', () => {
  const p = planResume([r(1), r(2), r(3)], [], NOW);
  assertEquals(p.toSend.map((x) => x.order_id), ['o1', 'o2', 'o3']);
  assertEquals([p.alreadySent, p.inFlight], [0, 0]);
});

Deno.test('the interrupted send: only orders with no sent row are mailed again', () => {
  const p = planResume([r(1), r(2), r(3), r(4), r(5)], [sent(1), sent(2), sent(4)], NOW);
  assertEquals(p.toSend.map((x) => x.order_id), ['o3', 'o5']);
  assertEquals(p.alreadySent, 3);
});

Deno.test('a finished send has nobody left', () => {
  const p = planResume([r(1), r(2)], [sent(1), sent(2)], NOW);
  assertEquals(p.toSend, []);
  assertEquals(p.alreadySent, 2);
});

Deno.test('a fresh claim by another request is left alone; a dead one is taken over', () => {
  const p = planResume([r(1), r(2)], [sending(1, 30_000), sending(2, STALE_CLAIM_MS + 1000)], NOW);
  assertEquals(p.inFlight, 1);
  assertEquals(p.toSend.map((x) => x.order_id), ['o2']);
});

Deno.test('a sent row wins over a leftover sending row for the same order', () => {
  const p = planResume([r(1)], [sending(1, STALE_CLAIM_MS * 3), sent(1)], NOW);
  assertEquals(p, { toSend: [], alreadySent: 1, inFlight: 0 });
});

Deno.test('a buyer who changed email is not mailed again at the new address', () => {
  const p = planResume([r(1, 'new-address@example.com')], [sent(1)], NOW);
  assertEquals(p.toSend, []);
  assertEquals(p.alreadySent, 1);
});

Deno.test('a new order that joined the cohort since the first press is included', () => {
  const p = planResume([r(1), r(9)], [sent(1)], NOW);
  assertEquals(p.toSend.map((x) => x.order_id), ['o9']);
});

Deno.test('an order sent earlier that has left the cohort is neither counted nor mailed', () => {
  const p = planResume([r(2)], [sent(1)], NOW);
  assertEquals(p, { toSend: [r(2)], alreadySent: 0, inFlight: 0 });
});

Deno.test('the same order listed twice is planned once', () => {
  assertEquals(planResume([r(1), r(1)], [], NOW).toSend.length, 1);
});

Deno.test('stale claims: the boundary and an unreadable timestamp', () => {
  assertEquals(isStaleClaim(ago(STALE_CLAIM_MS - 1), NOW), false);
  assertEquals(isStaleClaim(ago(STALE_CLAIM_MS), NOW), true);
  assertEquals(isStaleClaim('not a date', NOW), true);
});

const STORED = { kind: 'update', subject: 'A note on shipping', body_markdown: 'Hello', revised_ship_date: null };

Deno.test('same message under the same key matches', () => {
  assert(broadcastMatches(STORED, { kind: 'update', resolvedSubject: 'A note on shipping', bodyMarkdown: 'Hello', revisedShipDate: null }));
});

Deno.test('an edited body, subject, kind or date under the old key does not match', () => {
  const base = { kind: 'update', resolvedSubject: 'A note on shipping', bodyMarkdown: 'Hello', revisedShipDate: null };
  assertEquals(broadcastMatches(STORED, { ...base, bodyMarkdown: 'Hello!' }), false);
  assertEquals(broadcastMatches(STORED, { ...base, resolvedSubject: 'Another' }), false);
  assertEquals(broadcastMatches(STORED, { ...base, kind: 'delay_notice' }), false);
  assertEquals(broadcastMatches(STORED, { ...base, revisedShipDate: '2027-09-30' }), false);
});

Deno.test('complete first send: 200 with sent = everyone', () => {
  const s = summarizeSend('b1', { total: 5, alreadySent: 0, sentNow: 5, failed: 0, inFlight: 0, notReached: 0 });
  assertEquals(s.status, 200);
  assertEquals(s.body.sent, 5);
  assertEquals(s.body.sent_now, 5);
  assertEquals(s.body.duplicate, false);
});

Deno.test('resume that finishes: 200, sent counts both runs, not a duplicate', () => {
  const s = summarizeSend('b1', { total: 5, alreadySent: 3, sentNow: 2, failed: 0, inFlight: 0, notReached: 0 });
  assertEquals([s.status, s.body.sent, s.body.already_sent, s.body.sent_now, s.body.duplicate], [200, 5, 3, 2, false]);
});

Deno.test('pressing Send again after it all went: 200 duplicate, nothing sent now', () => {
  const s = summarizeSend('b1', { total: 5, alreadySent: 5, sentNow: 0, failed: 0, inFlight: 0, notReached: 0 });
  assertEquals([s.status, s.body.sent, s.body.sent_now, s.body.duplicate], [200, 5, 0, true]);
});

Deno.test('failures or a time-limited run answer 409 with a plain resume instruction', () => {
  const s = summarizeSend('b1', { total: 400, alreadySent: 0, sentNow: 150, failed: 2, inFlight: 0, notReached: 248 });
  assertEquals(s.status, 409);
  assertEquals(s.body.sent, 150);
  const msg = String(s.body.error);
  assert(msg.includes('2 could not be sent'));
  assert(msg.includes('248 not reached yet'));
  assert(msg.includes('Press Send again with the same message'));
  assert(!msg.includes('\u2014'));
});

Deno.test('another request mid-send answers 409 and says to wait', () => {
  const s = summarizeSend('b1', { total: 3, alreadySent: 1, sentNow: 0, failed: 0, inFlight: 2, notReached: 0 });
  assertEquals(s.status, 409);
  assert(String(s.body.error).includes('another request'));
});
