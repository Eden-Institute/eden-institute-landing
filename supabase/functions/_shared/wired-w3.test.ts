// deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/wired-w3.test.ts
//
// Wired quiz W3, the pure parts: signed tokens (no service-role fallback, rule 11), the dark
// gate, submission parsing, best-fit approach (answer 28a), tip order (28b), results payload.

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { signWiredToken, verifyWiredToken } from './wired-token.ts';
import { wiredGate, wiredOpen } from './wired-gate.ts';
import {
  bestFitApproach,
  buildResultsPayload,
  cleanAttribution,
  cleanNickname,
  cleanRanking,
  parseSubmission,
  tipFirst,
} from './wired-submit-core.ts';
import { DOMAINS, type Domain, type Scores } from './wired-engine.ts';

const FAM = '11111111-2222-4333-8444-555555555555';
const CHILD = '66666666-7777-4888-9999-000000000000';
const scores = (p: Partial<Record<Domain, number>>): Scores => Object.fromEntries(DOMAINS.map((d) => [d, p[d] ?? 0])) as Scores;

function withSecret<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const old = Deno.env.get('WIRED_LINK_SECRET');
  if (value === undefined) Deno.env.delete('WIRED_LINK_SECRET');
  else Deno.env.set('WIRED_LINK_SECRET', value);
  return fn().finally(() => {
    if (old === undefined) Deno.env.delete('WIRED_LINK_SECRET');
    else Deno.env.set('WIRED_LINK_SECRET', old);
  });
}
const SECRET = 'x'.repeat(48);

// ── tokens ──
Deno.test('token: round trip, purpose-bound, child carried, tamper and expiry refused', () =>
  withSecret(SECRET, async () => {
    const t = await signWiredToken({ familyId: FAM, purpose: 'results', childId: CHILD }, 1000);
    const g = await verifyWiredToken(t, 'results', 1001);
    assertEquals(g?.familyId, FAM);
    assertEquals(g?.childId, CHILD);
    assertEquals(await verifyWiredToken(t, 'delete', 1001), null, 'wrong purpose');
    assertEquals(await verifyWiredToken(t, 'results', 1000 + 365 * 24 * 3600), null, 'expired');
    const [b, s] = t.split('.');
    assertEquals(await verifyWiredToken(`${b}x.${s}`, 'results', 1001), null, 'tampered body');
    assertEquals(await verifyWiredToken(`${b}.${s.slice(0, -2)}AA`, 'results', 1001), null, 'tampered mac');
    assertEquals(await verifyWiredToken('nope', 'results', 1001), null);
    assertEquals(await verifyWiredToken(42, 'results', 1001), null);
  }));

Deno.test('token: a different secret cannot verify it', async () => {
  const t = await withSecret(SECRET, () => signWiredToken({ familyId: FAM, purpose: 'results' }, 1000));
  assertEquals(await withSecret('y'.repeat(48), () => verifyWiredToken(t, 'results', 1001)), null);
});

Deno.test('🛑 token: NO fallback to the service-role key (rule 11): a missing or short secret throws', async () => {
  const oldSr = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'z'.repeat(64));
  try {
    await withSecret(undefined, () => assertRejects(() => signWiredToken({ familyId: FAM, purpose: 'results' })));
    await withSecret('short', () => assertRejects(() => verifyWiredToken('a.b', 'results')));
  } finally {
    if (oldSr === undefined) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', oldSr);
  }
});

// ── dark gate ──
Deno.test('gate: dark by default (404), open with the preview token or WIRED_ENABLED=true', () => {
  const env = (vals: Record<string, string>) => (k: string) => vals[k];
  const req = (h: Record<string, string> = {}) => new Request('https://x/functions/v1/wired-bank', { headers: h });
  const token = 'p'.repeat(32);
  assertEquals(wiredGate(req(), env({}))?.status, 404);
  assertEquals(wiredGate(req({ 'x-wired-preview': 'wrong' }), env({ WIRED_PREVIEW_TOKEN: token }))?.status, 404);
  assertEquals(wiredGate(req({ 'x-wired-preview': token }), env({ WIRED_PREVIEW_TOKEN: token })), null);
  assertEquals(wiredGate(req(), env({ WIRED_ENABLED: 'true' })), null);
  // a too-short preview token is never accepted
  assertEquals(wiredOpen(req({ 'x-wired-preview': 'abc' }), env({ WIRED_PREVIEW_TOKEN: 'abc' })), false);
  assertEquals(wiredGate(new Request('https://x', { method: 'OPTIONS' }), env({}))?.status, 200);
});

// ── parsing ──
const FA = { kids: '2', prep: 'light', frustration: 'time', approach: 'charlotte_mason', budget: '100_300', esa: 'no' };
const good = () => ({
  email: '  Mom@Example.com ', first_name: ' Sarah ', child: { nickname: ' Lily ', grade: 2 },
  bank_version: 'k2-v1', answers: { scenarios: { 'k2-s01': 'k2-s01-a' }, frequency: { 'k2-f01': 3 } },
  family_answers: FA, ranking: ['prep', 'wiring', 'budget'], attribution: { utm_source: 'facebook', landing_path: '/wired?x=1#y', evil: 'z' },
});

Deno.test('parseSubmission: clean input normalised; set from the grade, never from the browser', () => {
  const r = parseSubmission({ ...good(), set_kind: 'g9_12' });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.value.email, 'mom@example.com');
  assertEquals(r.value.first_name, 'Sarah');
  assertEquals(r.value.child, { nickname: 'Lily', grade: 2 });
  assertEquals(r.value.set_kind, 'k2');
  assertEquals(r.value.ranking, ['prep', 'wiring', 'budget']);
  assertEquals(r.value.attribution, { utm_source: 'facebook', landing_path: '/wired' });
});

Deno.test('parseSubmission: refuses a bad email, nickname, grade, bank, answers or family code', () => {
  const bad = (patch: Record<string, unknown>) => parseSubmission({ ...good(), ...patch });
  assert(!bad({ email: 'mom@example.com.' }).ok);
  assert(!bad({ child: { nickname: '', grade: 2 } }).ok);
  assert(!bad({ child: { nickname: 'x'.repeat(41), grade: 2 } }).ok);
  assert(!bad({ child: { nickname: 'Lily', grade: 13 } }).ok);
  assert(!bad({ bank_version: 'k2' }).ok);
  assert(!bad({ answers: { scenarios: 'x' } }).ok);
  assert(!bad({ family_answers: { ...FA, budget: 'lots' } }).ok);
  assert(!bad({ family_answers: undefined }).ok, 'a child quiz needs family answers');
  const adult = parseSubmission({ email: 'm@e.co', set: 'adult', bank_version: 'adult-v1', answers: { scenarios: {}, frequency: {}, teaching: { 'ts-st1': 3 } } });
  assert(adult.ok && adult.value.child === null && adult.value.set_kind === 'adult');
});

Deno.test('nickname, ranking and attribution cleaners', () => {
  assertEquals(cleanNickname(' Li​ly\n '), 'Lily');
  assertEquals(cleanNickname(42), null);
  assertEquals(cleanRanking(['wiring', 'prep', 'budget', 'siblings']), ['wiring', 'prep', 'budget', 'siblings']);
  assertEquals(cleanRanking(['wiring', 'wiring', 'prep']), null);
  assertEquals(cleanRanking(['wiring', 'nope', 'prep']), null);
  assertEquals(cleanAttribution({ utm_campaign: 'x'.repeat(300), placement: 'header', nickname: 'Lily' }), { utm_campaign: 'x'.repeat(100), placement: 'header' });
});

// ── best-fit approach + tips ──
Deno.test('best-fit approach: highest MEAN wins (not the longest list), second within 5, Renaissance = eclectic', () => {
  // Maker/Designer/Connector strong: unit study (connector, maker, designer) mean beats Charlotte Mason
  const a = bestFitApproach(scores({ maker: 90, designer: 85, connector: 80, storyteller: 40 }), false, 'charlotte_mason');
  assertEquals(a.fits[0].approach, 'unit_study');
  assertEquals(a.fits[0].room_for, ['maker', 'designer']);
  assertEquals(a.already_there, false);
  // Close second: montessori (maker, designer, organizer, ponderer)
  const b = bestFitApproach(scores({ maker: 90, designer: 90, organizer: 85, ponderer: 85, connector: 80 }), false, 'montessori');
  assertEquals(b.fits.map((f) => f.approach), ['montessori', 'unit_study']);
  assertEquals(b.already_there, true);
  const r = bestFitApproach(scores({ storyteller: 70 }), true, 'eclectic');
  assertEquals(r.fits[0].approach, 'eclectic');
  assertEquals(r.already_there, true);
  // interest-led / online are never matched
  for (const x of [a, b]) assert(x.fits.every((f) => f.approach !== 'interest_led' && f.approach !== 'online'));
});

Deno.test('tips: frustration picks the first tip', () => {
  assertEquals(['engagement', 'enough', 'other', 'time', 'budget', 'multi_age', 'choosing', null].map(tipFirst),
    ['try_today', 'try_today', 'try_today', 'low_prep', 'low_prep', 'together', 'together', 'try_today']);
});

// ── results payload ──
Deno.test('results payload: a locked 3rd child sees only the top wiring; Family Map offered for 2+ kids', () => {
  const base = {
    quiz_year: 2026, scores: scores({ maker: 90, designer: 70, cultivator: 60 }), top3: ['maker', 'designer', 'cultivator'] as Domain[],
    renaissance: false, family_answers: FA as never, matches: [], coming_soon: [],
  };
  const locked = buildResultsPayload({ ...base, child: { id: CHILD, nickname: 'Ben', grade: 4, unlocked: false } });
  assertEquals(locked.preview, { top_wiring: 'maker' });
  assertEquals(locked.scores, undefined);
  assertEquals(locked.matches, undefined);
  assertEquals(locked.offers, { blueprint: true, family_map: true });
  const open = buildResultsPayload({ ...base, child: { id: CHILD, nickname: 'Lily', grade: 2, unlocked: true } });
  assertEquals(open.top3, ['maker', 'designer', 'cultivator']);
  assertEquals(open.tip_first, 'low_prep');
  assertEquals(open.set_kind, 'k2');
  assertEquals(open.approach?.her_approach, 'charlotte_mason');
});
