// Run with: deno test --no-lock -A supabase/functions/_shared/email-copy-both-bands.test.ts
//
// 2026-09-24 copy pass, once both elementary bands were on sale: the quiz arc's
// homeschool door, and the buyer sequence footer and timing.

import { assert, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildNurtureArc3 } from './nurture-email-templates.ts';
import {
  buildBuyerEmail1,
  buildBuyerEmail2,
  buildBuyerEmail3,
  buildBuyerEmail4,
} from './buyer-sequence-templates.ts';

const POSTAL = 'Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043';

Deno.test('quiz arc 3 names the two bands on sale and links the chooser and free weeks', () => {
  const { html } = buildNurtureArc3('Sarah', 'The Still Water', 'still-water');
  assertStringIncludes(html, '<strong>Sprouts</strong> for kindergarten through 2nd grade and <strong>Seedlings</strong> for grades 3-5');
  assertStringIncludes(html, 'href="https://edeninstitute.health/homeschool#choose-band"');
  assertStringIncludes(html, 'href="https://edeninstitute.health/freebies"');
  assert(!/K&ndash;12|K–12|launch news/.test(html), 'stale K-12 / launch-news copy');
  assert(!html.includes('—'), 'em dash');
});

Deno.test('every buyer email carries the postal address and one unsubscribe link', () => {
  for (const build of [buildBuyerEmail1, buildBuyerEmail2, buildBuyerEmail3, buildBuyerEmail4]) {
    const { html } = build('Sarah');
    assertStringIncludes(html, POSTAL);
    assert(html.split('{{UNSUB_URL}}').length - 1 === 1, 'exactly one unsubscribe placeholder');
  }
});

Deno.test('buyer email 3 no longer says the herb order lands in October', () => {
  const { html } = buildBuyerEmail3('Sarah');
  assert(!html.includes('in October'), 'kit ships July 2027, not October');
  assertStringIncludes(html, 'than one large order in the weeks before your kit ships.');
});
