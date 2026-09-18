// Run with: deno test supabase/functions/_shared/podcast-email-templates.test.ts
//
// Pins the founder-approved podcast welcome (2026-09-17) and its legal footer, so a
// later restyle cannot quietly change a sentence or drop the address or unsubscribe.

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildPodcastWelcomeEmail } from './podcast-email-templates.ts';

Deno.test('podcast welcome keeps its subject, approved copy and legal footer', () => {
  const { subject, html } = buildPodcastWelcomeEmail('Sarah');
  assertEquals(subject, "You're on the list for Tales & Table Talk");
  for (const needle of [
    'Hi Sarah,',
    "Thank you for joining the Tales and Table Talk list. I'm so glad you're here.",
    'Tales and Table Talk is a weekly read-aloud podcast for moms and their littles. Every episode is a story, and every episode ends at the table, with my girls and me talking about what we just heard.',
    "We launch in January on the Ultimate Homeschool Podcast Network. You'll be the first to hear when the first episode goes live, along with the printable questions that go with it.",
    'Until then, go read them something, and then talk about it.',
    'Camila',
  ]) {
    assertStringIncludes(html, needle);
  }
  assertStringIncludes(html, 'Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043');
  assertStringIncludes(html, '<a href="{{UNSUB_URL}}"');
  assertEquals(html.split('{{UNSUB_URL}}').length - 1, 1, 'exactly one unsubscribe placeholder');
  assert(!html.includes('—'), 'no em dashes');
  assert(!html.includes('Eden Institute'), 'podcast email carries no Eden branding');
});
