import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  checkBroadcastHtml,
  checkScheduledAt,
  isBroadcastAudience,
  isBroadcastSegmentName,
  planStage,
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
  assertEquals(isBroadcastAudience('everyone'), false);
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
