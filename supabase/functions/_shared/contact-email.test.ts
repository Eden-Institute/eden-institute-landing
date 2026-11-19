// deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/contact-email.test.ts
//
// The site's email guard against Stripe's own verdicts, probed in Stripe TEST mode on
// 2026-11-19 (customers.create and checkout.sessions.create customer_email agreed on
// every address below). No network.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { cleanContactEmail, isStripeSafeEmail, STRIPE_SAFE_EMAIL_RE } from './contact-email.ts';

// The old check, which passed every address in STRIPE_REFUSED except "@@".
const OLD_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STRIPE_REFUSED = [
  'jane@example.com.',
  'jane@example.com..',
  'jane@example.co.',
  'jane@example.com,',
  'jane@example.com;',
  'jane@example.com)',
  'jane@example.com\\',
  '<jane@example.com>',
  'jane@example.com​',
  'jane@@example.com',
  'jane@.example.com',
];

const STRIPE_ACCEPTED = [
  'jane@example.com',
  'Jane@Example.COM',
  'jane+eden@example.com',
  "o'brien@example.com",
  'jane@example..com',
  'jane.@example.com',
  '.jane@example.com',
  'jane..doe@example.com',
  'jane@-example.com',
  'jane@-.example.com',
  'jane@example.-com',
  'jane@example.com-',
  'jane@exa_mple.com',
  'jane@example.c',
  'jane@example.co1',
  'jane@example.con',
  'jane@example.comm',
  'jané@example.com',
  'jane@exämple.com',
  '"jane"@example.com',
  'a@b.co',
  'jane@sub.example.co.uk',
];

Deno.test('refuses every address Stripe refused (the old check passed 10 of these 11)', () => {
  for (const e of STRIPE_REFUSED) assert(!isStripeSafeEmail(e), `should refuse ${JSON.stringify(e)}`);
  assertEquals(STRIPE_REFUSED.filter((e) => OLD_RE.test(e)).length, 10);
});

Deno.test('accepts every address Stripe accepted (never turns away a real one)', () => {
  for (const e of STRIPE_ACCEPTED) assert(isStripeSafeEmail(e), `should accept ${JSON.stringify(e)}`);
});

Deno.test('still refuses what the old check refused', () => {
  for (const e of ['', 'jane', 'jane@example', 'jane example.com', 'jane@exa mple.com', '@example.com', 'jane@']) {
    assert(!STRIPE_SAFE_EMAIL_RE.test(e), `should refuse ${JSON.stringify(e)}`);
  }
});

Deno.test('cleanContactEmail trims, caps the length, and returns null for anything unusable', () => {
  assertEquals(cleanContactEmail('  mom@example.com '), 'mom@example.com');
  assertEquals(cleanContactEmail('mom@example.com.'), null);
  assertEquals(cleanContactEmail(null), null);
  assertEquals(cleanContactEmail(undefined), null);
  assertEquals(cleanContactEmail(`${'x'.repeat(249)}@b.co`), `${'x'.repeat(249)}@b.co`); // 254
  assertEquals(cleanContactEmail(`${'x'.repeat(250)}@b.co`), null); // 255
});
