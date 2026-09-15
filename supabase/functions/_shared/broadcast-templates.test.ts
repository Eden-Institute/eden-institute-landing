// Run with: deno test supabase/functions/_shared/broadcast-templates.test.ts
//
// The footer on a delay notice or preorder update used to be produced by
// string-replacing the quiz sentence out of emailWrapper's output. The wrapper
// writes the apostrophe as &rsquo;, the replacement looked for a straight one,
// and every notice shipped telling buyers they were getting it because they took
// the Constitutional Assessment. These tests pin the rendered footer.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildDelayNoticeEmail, buildUpdateEmail } from './broadcast-templates.ts';

const QUIZ_REASON = 'completed the Constitutional Assessment';

function delayNotice(): string {
  return buildDelayNoticeEmail({
    firstName: 'Ruth',
    bodyMarkdown: 'The printer needs more time.',
    revisedShipDate: 'October 15, 2027',
    requiresOptIn: false,
    consentUrl: 'https://edeninstitute.health/consent',
    cancelUrl: 'https://edeninstitute.health/cancel',
    orderNumber: 'ET-1000',
  });
}

Deno.test('delay notice carries the preorder notice footer, not the quiz footer', () => {
  const html = delayNotice();
  assert(!html.includes(QUIZ_REASON), 'quiz provenance line must not appear');
  assert(html.includes(
    'You are receiving this because you placed a preorder at edeninstitute.health. '
      + 'This is a required notice about your order and is not marketing.',
  ));
});

Deno.test('preorder update carries the preorder footer, not the quiz footer', () => {
  const html = buildUpdateEmail({ firstName: 'Ruth', bodyMarkdown: 'Proofs are in.' });
  assert(!html.includes(QUIZ_REASON), 'quiz provenance line must not appear');
  assert(html.includes('You are receiving this because you placed a preorder at edeninstitute.health.'));
  assert(!html.includes('This is a required notice about your order'));
});

Deno.test('transactional broadcasts carry no unsubscribe placeholder', () => {
  for (const html of [delayNotice(), buildUpdateEmail({ firstName: 'Ruth', bodyMarkdown: 'x' })]) {
    assertEquals(html.includes('{{UNSUB_URL}}'), false);
  }
});

Deno.test('the first name is escaped', () => {
  const html = buildUpdateEmail({ firstName: '<b>Ruth</b>', bodyMarkdown: 'x' });
  assert(html.includes('Hi &lt;b&gt;Ruth&lt;/b&gt;,'));
});
