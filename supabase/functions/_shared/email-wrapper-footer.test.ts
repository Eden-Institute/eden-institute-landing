// Run with: deno test supabase/functions/_shared/email-wrapper-footer.test.ts
//
// Receipts, shipping and refund notes, and preorder delay / update notices use
// emailWrapperTransactional. Until 2026-11-09 their footer showed a link labelled
// "Unsubscribe" that only opened the homepage, because a buyer cannot opt out of
// order notices. Camila's tap 2026-11-06: "Remove it from receipts". These tests pin
// that the transactional footer has no Unsubscribe row at all, keeps the "why am I
// getting this" line and the postal address, and that marketing emails still carry
// the real {{UNSUB_URL}} placeholder exactly once.

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { emailWrapper, emailWrapperTransactional, type EmailProvenance } from './nurture-email-templates.ts';

const ADDRESS = 'Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043';
const TRANSACTIONAL: EmailProvenance[] = ['order', 'preorder', 'preorder_update', 'preorder_notice'];

Deno.test('transactional footer: no Unsubscribe link, no placeholder, provenance and address kept', () => {
  for (const p of TRANSACTIONAL) {
    for (const shopCard of [true, false]) {
      const html = emailWrapperTransactional('<p>Your order</p>', p, { shopCard });
      assertEquals(html.includes('Unsubscribe'), false, `${p}: no Unsubscribe label`);
      assertEquals(html.includes('{{UNSUB_URL}}'), false, `${p}: no placeholder`);
      assertStringIncludes(html, ADDRESS);
      assertStringIncludes(html, 'because you placed');
    }
  }
});

Deno.test('order receipt keeps its own provenance sentence', () => {
  const html = emailWrapperTransactional('<p>x</p>', 'order');
  assertStringIncludes(html, 'You&rsquo;re receiving this because you placed an order at edeninstitute.health.');
});

Deno.test('marketing footer still carries exactly one real unsubscribe placeholder', () => {
  for (const p of ['constitution', 'back_to_eden', 'homeschool'] as EmailProvenance[]) {
    const html = emailWrapper('<p>x</p>', p);
    assertEquals(html.split('{{UNSUB_URL}}').length - 1, 1, `${p}: one placeholder`);
    assertStringIncludes(html, '>Unsubscribe</a>');
    assertStringIncludes(html, ADDRESS);
  }
});

Deno.test('transactional and marketing chrome differ only by the Unsubscribe row', () => {
  const tx = emailWrapperTransactional('<p>x</p>', 'order');
  const mkt = emailWrapper('<p>x</p>', 'order');
  const row = mkt.slice(mkt.indexOf('\n<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}"'));
  assert(row.startsWith('\n<tr><td'), 'found the Unsubscribe row');
  assertEquals(mkt.replace(row.slice(0, row.indexOf('</td></tr>') + '</td></tr>'.length), ''), tx);
});
