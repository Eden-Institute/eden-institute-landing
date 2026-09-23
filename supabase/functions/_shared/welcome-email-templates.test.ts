// Run with: deno test supabase/functions/_shared/welcome-email-templates.test.ts
//
// The welcome emails were restyled on 2026-09-15 to wear the shared chrome. Only the
// look was meant to change. These tests pin the wording, links, subject and footer so a
// later restyle cannot quietly drop a sentence, a download link or the legal footer.

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildHomeschoolEmail, buildSeedlingsMagnetEmail, buildSproutsMagnetEmail } from './welcome-email-templates.ts';

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

Deno.test('homeschool waitlist welcome keeps its subject, copy, link and footer', () => {
  const { subject, html } = buildHomeschoolEmail('Sarah');
  assertEquals(subject, "You're on the Eden's Table Waitlist: Here's What's Coming");
  assertAll(html, [
    'Hi Sarah,',
    "You're on the list.",
    "Eden's Table is a K–12 Biblical herbalism curriculum being built for families who believe the earth was created with purpose, and that stewarding it well begins at home. You'll be among the first to see it, price it, and shape it.",
    'While we finish building, consider starting with our adult foundations course. Most of our homeschool families tell us it changed how they teach, because it changed how they understand.',
    'href="https://learn.edeninstitute.health/course/back-to-eden1"',
    'Explore the Foundations Course',
    "You're receiving this because you signed up at edeninstitute.health.</td>",
    ...CLOSING,
  ]);
  assertLegalFooter(html);
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
    'The printed card decks are not part of the free week; everything you need to teach these five days is in the guide and the notebook.',
    'In about a week I will write again about the weeks that follow it, and there is nothing you need to do before then.',
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
    'In about a week I will write again with what comes next, and there is nothing you need to do before then.',
    'The Eden Institute | edeninstitute.health',
    "You're receiving this because you signed up at edeninstitute.health. No spam, ever.",
    'Shop Medicinal Herbs',
    ...CLOSING,
  ]);
  assertLegalFooter(html);
  assert(!html.includes('hs-seedlings-w1-ra-'), 'Seedlings has no Week 1 story; its bonus read-aloud is Story Seven (Week 2)');
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
