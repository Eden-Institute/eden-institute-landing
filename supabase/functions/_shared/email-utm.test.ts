// deno test --no-lock supabase/functions/_shared/email-utm.test.ts
//
// Pins the email UTM tagger: which links get tagged, how the query is built, and the
// links it must never touch (downloads, legal pages, tokens, other hosts).

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { tagEmailHtml, tagEmailText, tagEmailUrl, type EmailTag } from './email-utm.ts';

const TAG: EmailTag = { medium: 'nurture', content: 'constitution_2' };
const Q = 'utm_source=email&utm_medium=nurture&utm_content=constitution_2';
const QA = 'utm_source=email&amp;utm_medium=nurture&amp;utm_content=constitution_2';

Deno.test('plain link gets ?utm_...', () => {
  assertEquals(tagEmailUrl('https://edeninstitute.health/books', TAG), `https://edeninstitute.health/books?${Q}`);
});

Deno.test('bare origin gets a slash before the query', () => {
  assertEquals(tagEmailUrl('https://edeninstitute.health', TAG), `https://edeninstitute.health/?${Q}`);
});

Deno.test('existing query is appended to with &', () => {
  assertEquals(
    tagEmailUrl('https://edeninstitute.health/go/course?src=ch1-email', TAG),
    `https://edeninstitute.health/go/course?src=ch1-email&${Q}`,
  );
});

Deno.test('query goes BEFORE the #fragment', () => {
  assertEquals(
    tagEmailUrl('https://edeninstitute.health/books#seedlings', TAG),
    `https://edeninstitute.health/books?${Q}#seedlings`,
  );
  assertEquals(
    tagEmailUrl('https://edeninstitute.health/homeschool?x=1#choose-band', TAG),
    `https://edeninstitute.health/homeschool?x=1&${Q}#choose-band`,
  );
});

Deno.test('campaign is added when given; values lowercased and encoded', () => {
  assertEquals(
    tagEmailUrl('https://edeninstitute.health/starter', { medium: 'Newsletter', content: 'List Announce', campaign: 'seedlings_live_2026_09_24' }),
    'https://edeninstitute.health/starter?utm_source=email&utm_medium=newsletter&utm_content=list%20announce&utm_campaign=seedlings_live_2026_09_24',
  );
});

Deno.test('an already-tagged link is left alone', () => {
  const u = 'https://edeninstitute.health/back-to-eden?utm_source=email&utm_medium=nurture&utm_campaign=quiz_arc2';
  assertEquals(tagEmailUrl(u, TAG), u);
  const v = 'https://edeninstitute.health/books?ref=x&UTM_campaign=hand';
  assertEquals(tagEmailUrl(v, TAG), v);
});

Deno.test('excluded: files, unsubscribe, thank-you, session_id, t= token, legal, downloads, guide access', () => {
  const untouched = [
    'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-tg-lavender.pdf',
    'https://edeninstitute.health/email/apothecary-icon.png',
    'https://edeninstitute.health/x/photo.JPEG',
    'https://edeninstitute.health/unsubscribe?token=a%2Bb%2Fc.d%3D',
    'https://edeninstitute.health/starter/thank-you?session_id={CHECKOUT_SESSION_ID}',
    'https://edeninstitute.health/starter/seedlings/thank-you',
    'https://edeninstitute.health/preorder?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    'https://edeninstitute.health/sprouts-founders.html?t=abc.def',
    'https://edeninstitute.health/preorder-response?token=abc',
    'https://edeninstitute.health/returns',
    'https://edeninstitute.health/privacy',
    'https://edeninstitute.health/terms',
    'https://edeninstitute.health/starter/downloads?t=tok',
    'https://edeninstitute.health/back-to-eden/download?t=tok',
    'https://edeninstitute.health/guide/frozen-knot?access=a.b',
  ];
  for (const u of untouched) assertEquals(tagEmailUrl(u, TAG), u, u);
});

Deno.test('/partner-sample?k= is tagged and keeps k intact', () => {
  assertEquals(
    tagEmailUrl('https://edeninstitute.health/partner-sample?k=AbC123', TAG),
    `https://edeninstitute.health/partner-sample?k=AbC123&${Q}`,
  );
});

Deno.test('www host and http are tagged', () => {
  assertEquals(tagEmailUrl('https://www.edeninstitute.health/books', TAG), `https://www.edeninstitute.health/books?${Q}`);
  assertEquals(tagEmailUrl('http://edeninstitute.health/books', TAG), `http://edeninstitute.health/books?${Q}`);
});

Deno.test('other hosts are untouched, including look-alikes', () => {
  const untouched = [
    'https://www.facebook.com/EdensTableHomeschoolCurriculum',
    'https://checkout.stripe.com/c/pay/cs_live_abc',
    'https://edeninstitute.health.evil.example/books',
    'https://notedeninstitute.health/books',
    'mailto:hello@edeninstitute.health',
    'https://xyz.supabase.co/storage/v1/object/sign/partner-assets/sample/a.pdf?token=1',
  ];
  for (const u of untouched) assertEquals(tagEmailUrl(u, TAG), u, u);
});

Deno.test('an unrendered ${...} template is skipped, not guessed', () => {
  const u = 'https://edeninstitute.health/results/${slug}';
  assertEquals(tagEmailUrl(u, TAG), u);
});

Deno.test('HTML: adds &amp; separators and leaves existing &amp; alone', () => {
  const html = `<a href="https://edeninstitute.health/homeschool?a=1&amp;b=2#choose-band">x</a>`
    + `<a href='https://edeninstitute.health/starter'>y</a>`
    + `<a href="https://edeninstitute.health/unsubscribe?token=z">unsub</a>`
    + `<a href="https://www.facebook.com/x">fb</a>`
    + `<img src="https://edeninstitute.health/email/logo.png">`
    + `<p>Visit edeninstitute.health/books today.</p>`;
  assertEquals(
    tagEmailHtml(html, TAG),
    `<a href="https://edeninstitute.health/homeschool?a=1&amp;b=2&amp;${QA}#choose-band">x</a>`
      + `<a href='https://edeninstitute.health/starter?${QA}'>y</a>`
      + `<a href="https://edeninstitute.health/unsubscribe?token=z">unsub</a>`
      + `<a href="https://www.facebook.com/x">fb</a>`
      + `<img src="https://edeninstitute.health/email/logo.png">`
      + `<p>Visit edeninstitute.health/books today.</p>`,
  );
});

Deno.test('HTML: tagging twice is a no-op the second time', () => {
  const once = tagEmailHtml('<a href="https://edeninstitute.health/books">b</a>', TAG);
  assertEquals(tagEmailHtml(once, TAG), once);
});

Deno.test('text body: bare URLs tagged with &, trailing punctuation kept outside', () => {
  const text = [
    'Start here: https://edeninstitute.health/starter.',
    'Or browse (https://edeninstitute.health/books#buy), any time.',
    'Download: https://edeninstitute.health/back-to-eden/download?t=tok',
    'Policy: https://edeninstitute.health/returns',
  ].join('\n');
  assertEquals(
    tagEmailText(text, TAG),
    [
      `Start here: https://edeninstitute.health/starter?${Q}.`,
      `Or browse (https://edeninstitute.health/books?${Q}#buy), any time.`,
      'Download: https://edeninstitute.health/back-to-eden/download?t=tok',
      'Policy: https://edeninstitute.health/returns',
    ].join('\n'),
  );
});
