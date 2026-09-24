import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { bandFromSource, buildBandWaitlistRow, normalizeUsPhone, smsConsentText } from './band-waitlist.ts';
import { buildBandWaitlistEmail } from './welcome-email-templates.ts';

const NOW = new Date('2026-09-24T12:00:00Z');
const base = { email: 'a@b.com', band: 'cultivators' as const, firstName: 'Ann', sourceUrl: null, now: NOW };

Deno.test('bandFromSource maps only the two band waitlists', () => {
  assertEquals(bandFromSource('cultivators_waitlist'), 'cultivators');
  assertEquals(bandFromSource('practitioners_waitlist'), 'practitioners');
  assertEquals(bandFromSource('sprouts_magnet'), null);
  assertEquals(bandFromSource('waitlist'), null);
  assertEquals(bandFromSource(null), null);
});

Deno.test('normalizeUsPhone accepts the ways people type a US number', () => {
  for (const s of ['(931) 555-0100', '931.555.0100', '9315550100', '1-931-555-0100', '+1 931 555 0100']) {
    assertEquals(normalizeUsPhone(s), '+19315550100', s);
  }
  for (const s of ['555-0100', '(131) 555-0100', '931 055 0100', '+44 20 7946 0958', '', 'call me']) {
    assertEquals(normalizeUsPhone(s), null, s);
  }
});

Deno.test('no phone: row has no phone and no consent', () => {
  const r = buildBandWaitlistRow({ ...base, phoneRaw: '', smsConsent: false });
  assert(r.ok);
  assertEquals('phone' in r.row, false);
  assertEquals('sms_consent' in r.row, false);
});

Deno.test('phone without the box: phone saved, no consent recorded', () => {
  const r = buildBandWaitlistRow({ ...base, phoneRaw: '931-555-0100', smsConsent: false });
  assert(r.ok);
  assertEquals(r.row.phone, '+19315550100');
  assertEquals('sms_consent' in r.row, false);
});

Deno.test('phone with the box: consent recorded with the exact words and time', () => {
  const r = buildBandWaitlistRow({ ...base, phoneRaw: '931-555-0100', smsConsent: true });
  assert(r.ok);
  assertEquals(r.row.sms_consent, true);
  assertEquals(r.row.sms_consent_text, smsConsentText('cultivators'));
  assertEquals(r.row.sms_consent_at, NOW.toISOString());
});

Deno.test('bad phone or box without a phone is a visitor-facing error', () => {
  assertEquals(buildBandWaitlistRow({ ...base, phoneRaw: '555', smsConsent: false }).ok, false);
  assertEquals(buildBandWaitlistRow({ ...base, phoneRaw: '', smsConsent: true }).ok, false);
  // Only a real boolean true counts as consent.
  const r = buildBandWaitlistRow({ ...base, phoneRaw: '9315550100', smsConsent: 'true' });
  assert(r.ok);
  assertEquals('sms_consent' in r.row, false);
});

Deno.test('consent wording is the founder-approved text, no em dashes', () => {
  assertEquals(
    smsConsentText('practitioners'),
    'Text me when Practitioners opens: launch alerts from The Eden Institute, up to 3 messages. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase. See our Terms and Privacy Policy.',
  );
  assert(!smsConsentText('cultivators').includes('—'));
});

Deno.test('band waitlist welcome names its band, never the other, and has no em dash', () => {
  const c = buildBandWaitlistEmail('Ann', 'cultivators');
  const pr = buildBandWaitlistEmail('Ann', 'practitioners');
  assert(c.subject.includes('Cultivators') && !c.html.includes('Practitioners'));
  assert(pr.subject.includes('Practitioners') && !pr.html.includes('Cultivators'));
  for (const e of [c, pr]) {
    assert(!e.html.includes('—'), 'em dash');
    assert(e.html.includes('https://edeninstitute.health/homeschool#choose-band'));
    assert(!/text you|texts? (?:you|will)/i.test(e.html), 'must not promise texts');
  }
});
