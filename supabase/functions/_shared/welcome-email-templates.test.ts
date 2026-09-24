// Run with: deno test supabase/functions/_shared/welcome-email-templates.test.ts
//
// The welcome emails were restyled on 2026-09-15 to wear the shared chrome. Only the
// look was meant to change. These tests pin the wording, links, subject and footer so a
// later restyle cannot quietly drop a sentence, a download link or the legal footer.

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildBandWaitlistEmail, buildHomeschoolEmail, buildSeedlingsMagnetEmail, buildSproutsMagnetEmail } from './welcome-email-templates.ts';

const POSTAL = 'Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043';
const UNSUB = '<a href="{{UNSUB_URL}}"';
const CLOSING = ["We'll be in touch soon.", 'Camila Johnson', 'The Eden Institute'];

function assertAll(html: string, needles: string[]) {
  for (const n of needles) assertStringIncludes(html, n);
}

function assertLegalFooter(html: string) {
  assertStringIncludes(html, POSTAL);
  assertStringIncludes(html, UNSUB);
  assertEquals(html.split('{{UNSUB_URL}}').length - 1, 1, 'exactly one unsubscribe placeholder');
  assert(!html.includes('—'), 'no em dashes');
}

// Rewritten 2026-09-24: both elementary bands are on sale, so the fallback welcome
// no longer says the curriculum is being built or points at the adult course.
Deno.test("Eden's Table welcome names both bands on sale, the start rule and the links", () => {
  const { subject, html } = buildHomeschoolEmail('Sarah');
  assertEquals(subject, "Welcome to Eden's Table");
  assertAll(html, [
    'Hi Sarah,',
    "Welcome to Eden's Table. I am so glad you are here.",
    '<strong>Sprouts</strong> for kindergarten through second grade, and <strong>Seedlings</strong> for grades 3 to 5.',
    'Children in grades 3 to 5 who are new to herbs start with Sprouts too',
    'If they already know the basics, they can go straight to Seedlings.',
    'And if you have children in both, teach Sprouts to everyone together first.',
    'href="https://edeninstitute.health/homeschool#choose-band"',
    'href="https://edeninstitute.health/freebies"',
    'href="https://edeninstitute.health/books#buy"',
    'href="https://edeninstitute.health/books#seedlings"',
    '$249 plus flat $12 shipping',
    "You're receiving this because you signed up at edeninstitute.health.</td>",
    ...CLOSING,
  ]);
  assertLegalFooter(html);
  assert(!/waitlist|being built|finish building|K–12|K&ndash;12/i.test(subject + html), 'stale waitlist / being-built copy');
  assert(!html.includes('learn.edeninstitute.health'), 'no longer pushes the adult course');
  assert(!/kit|preorder|credit/i.test(html), 'never the kit, preorder or a credit');
  assert(!html.includes('Shop Medicinal Herbs'), 'the homeschool welcome never carried the shop card');
});

Deno.test('Sprouts week 1 welcome keeps its subject, copy, three downloads and footer', () => {
  const { subject, html } = buildSproutsMagnetEmail('Sarah');
  assertEquals(subject, 'Your Sprouts Week 1 (Lavender) is ready');
  assertAll(html, [
    'Hi Sarah,',
    'Thank you for stepping into this work with us. What follows is a real week of curriculum: Week 1 of Sprouts, the band built for kindergarten through second grade.',
    'Five days with Lavender, a story your child will remember, and the small daily rhythms that turn a kitchen counter into a place of formation.',
    'YOUR THREE DOWNLOADS: SPROUTS WEEK 1 (LAVENDER)',
    'MEET THE FAMILY (READ-ALOUD)', "TEACHER'S GUIDE", 'STUDENT NOTEBOOK',
    'href="https://edeninstitute.health/lead-magnets/hs-sprouts-w1-ra-lavender.pdf"',
    'href="https://edeninstitute.health/lead-magnets/hs-sprouts-w1-tg-lavender.pdf"',
    'href="https://edeninstitute.health/lead-magnets/hs-sprouts-w1-nb-lavender.pdf"',
    'THIS IS A WHOLE WEEK',
    'Everything you need to teach these five days is in the guide and the notebook.',
    'In about a week I will write again about the weeks that follow it, and there is nothing you need to do before then.',
    // 2026-09-24 start rule: older children who know the basics can start with Seedlings.
    'If you have children in grades 3 to 5 who already know the basics of herbs, they can start with Seedlings, the next thirty-six plants.',
    'href="https://edeninstitute.health/freebies"',
    'The Eden Institute | edeninstitute.health',
    "You're receiving this because you signed up at edeninstitute.health. No spam, ever.",
    'Shop Medicinal Herbs',
    ...CLOSING,
  ]);
  assertLegalFooter(html);
});

Deno.test('Seedlings week 1 welcome keeps its subject, copy, three downloads and footer', () => {
  const { subject, html } = buildSeedlingsMagnetEmail('Sarah');
  assertEquals(subject, 'Your Seedlings Week 1 (Elderberry) is ready');
  assertAll(html, [
    'Hi Sarah,',
    'What follows is a real week of curriculum from Seedlings, our band for third through fifth graders.',
    'Seedlings is built for the child who has begun to ask <em>why</em> and <em>how</em>, the one who has outgrown a worksheet and is ready to track a hypothesis across a week. Week 1 starts with Elderberry.',
    'YOUR THREE DOWNLOADS: SEEDLINGS WEEK 1 (ELDERBERRY)',
    "TEACHER'S GUIDE", 'STUDENT NOTEBOOK', 'STORY SEVEN: BE STILL (READ-ALOUD)',
    'href="https://edeninstitute.health/lead-magnets/hs-seedlings-w1-tg-elderberry.pdf"',
    'href="https://edeninstitute.health/lead-magnets/hs-seedlings-w1-nb-elderberry.pdf"',
    'href="https://edeninstitute.health/lead-magnets/hs-seedlings-w2-ra-be-still.pdf"',
    'The read-aloud is a bonus: Story Seven, Be Still, the first story of the Seedlings year, which families read together in Week 2.',
    'THIS IS A WHOLE WEEK',
    'Elderberry is Week 1 of the curriculum exactly as it is taught.',
    // 2026-09-24 start rule: a family new to herbs starts with Sprouts.
    'New to herbs? Even with a child in grades 3 to 5, most families start with Sprouts, because its thirty-six plants are the ones Seedlings builds on.',
    'href="https://edeninstitute.health/freebies"',
    'In about a week I will write again with what comes next, and there is nothing you need to do before then.',
    'The Eden Institute | edeninstitute.health',
    "You're receiving this because you signed up at edeninstitute.health. No spam, ever.",
    'Shop Medicinal Herbs',
    ...CLOSING,
  ]);
  assertLegalFooter(html);
  assert(!html.includes('hs-seedlings-w1-ra-'), 'Seedlings has no Week 1 story; its bonus read-aloud is Story Seven (Week 2)');
});

Deno.test('free-week welcomes no longer mention the retired card decks', () => {
  for (const { html } of [buildSproutsMagnetEmail('Sarah'), buildSeedlingsMagnetEmail('Sarah')]) {
    assert(!/card deck/i.test(html), 'card decks were retired with the kit (2026-09-12)');
  }
});

Deno.test('band waitlist welcome links the free weeks', () => {
  for (const band of ['cultivators', 'practitioners'] as const) {
    const { html } = buildBandWaitlistEmail('Sarah', band);
    assertStringIncludes(html, '<a href="https://edeninstitute.health/freebies"');
    assertStringIncludes(html, 'Week 1 of both is free</a>, if you would like to try before anything else.');
    assertLegalFooter(html);
  }
});

Deno.test('welcome emails wear the shared chrome (forest header, gold rules, forest footer)', () => {
  for (const { html } of [buildHomeschoolEmail('Sarah'), buildSproutsMagnetEmail('Sarah'), buildSeedlingsMagnetEmail('Sarah')]) {
    assertStringIncludes(html, 'background-color:#2C3E2D;padding:40px 20px;');
    assertStringIncludes(html, 'background-color:#2C3E2D;padding:30px 20px;');
    assertStringIncludes(html, 'border-top:2px solid #C5A44E;');
    assert(!html.includes('#1C3A2E'), 'old palette forest must be gone');
    assert(!html.includes('#C9A84C'), 'old palette gold must be gone');
  }
});
