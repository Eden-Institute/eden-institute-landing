// deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/wired-display.test.ts
//
// Lane 2, 2026-11-21 (Camila's taps): what the results page shows next to the ranking.
//   1. Match display fields: the affiliate link only when flagged AND present (curriculum_finder_list's rule),
//      price + basis as stored, the prep code; read AFTER ranking and never reordering it (rule 3).
//   2. Helpful extras (spec answer 38): up to 3 non-curriculum rows by top wirings + grade (blank = any) + her
//      Christian / ESA / budget filters; affiliate status never changes which show or their order.
//   3. The later $28 upgrade: a live Blueprint this quiz year and no live Family Map (create-checkout's gate).

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DOMAINS, type Domain, quizYear, type Scores } from './wired-engine.ts';
import { rankCurricula, toMatchCurriculum } from './wired-match.ts';
import { displayLink, EXTRAS_LIMIT, familyMapUpgrade, isHelpfulExtra, pickHelpfulExtras, withDisplay } from './wired-display.ts';
import { familyMapUpgradeFor, helpfulExtraRows, matchDisplayRows } from './wired-submit-flow.ts';

const scores = (p: Partial<Record<Domain, number>>): Scores => Object.fromEntries(DOMAINS.map((d) => [d, p[d] ?? 0])) as Scores;
const CHILD = scores({ maker: 80, designer: 70, cultivator: 50, storyteller: 20 });
const TOP3: Domain[] = ['maker', 'designer', 'cultivator'];
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

// deno-lint-ignore no-explicit-any
function extra(over: Record<string, any> = {}) {
  return {
    id: over.id ?? uuid(), name: 'Extra', grade_min: null, grade_max: null, domains_served: ['Maker'], faith_alignment: 'Secular / neutral',
    price_cents: 0, approved: true, coming_soon: false, eden_band: null, prep_load: null, multi_age: false,
    resource_type: 'App', screen_based: true, url: 'https://example.com/x', affiliate_url: null, is_affiliate: false, ...over,
  };
}
const prefs = (filters = {}, budget = '100_300') => ({ budget, filters });

// ── 1. Match display fields ──────────────────────────────────────────────────

Deno.test('displayLink: the affiliate link only when flagged AND present, else the normal link', () => {
  assertEquals(displayLink({ url: 'https://a.test', affiliate_url: 'https://aff.test?ref=eden', is_affiliate: true }), { url: 'https://aff.test?ref=eden', is_affiliate: true });
  assertEquals(displayLink({ url: 'https://a.test', affiliate_url: ' ', is_affiliate: true }), { url: 'https://a.test', is_affiliate: false });
  assertEquals(displayLink({ url: 'https://a.test', affiliate_url: 'https://aff.test', is_affiliate: false }), { url: 'https://a.test', is_affiliate: false });
  assertEquals(displayLink({}), { url: null, is_affiliate: false });
});

Deno.test('withDisplay: adds url / is_affiliate / price_cents / price_basis / prep code, keeps order and every ranking field', () => {
  const ids = [uuid(), uuid(), uuid()];
  const rows = ids.map((id, i) => ({
    id, name: `C${i}`, grade_min: 0, grade_max: 5, domains_served: ['Maker'], prep_load: 'Open-and-go', price_cents: i === 1 ? 0 : 5000 * (i + 1),
    multi_age: true, faith_alignment: 'Christian (explicit)', approved: true, coming_soon: false, eden_band: null,
  }));
  const out = rankCurricula({ grade: 2, scores: CHILD, top3: TOP3, prefs: { kids: '2', prep: 'light', budget: '100_300' }, curricula: rows.map(toMatchCurriculum) });
  const display = [
    { id: ids[0], url: 'https://c0.test', affiliate_url: 'https://aff0.test', is_affiliate: true, price_cents: 5000, price_basis: 'Per family per year', prep_load: 'Open-and-go' },
    { id: ids[1], url: 'https://c1.test', affiliate_url: null, is_affiliate: false, price_cents: 0, price_basis: 'Free', prep_load: 'Light' },
  ];
  const shown = withDisplay(out.matches, display);
  assertEquals(shown.map((m) => m.id), out.matches.map((m) => m.id), 'order never changes');
  for (const [i, m] of shown.entries()) {
    assertEquals(m.score, out.matches[i].score);
    assertEquals(m.because, out.matches[i].because);
    assertEquals(m.components, out.matches[i].components);
  }
  const by = new Map(shown.map((m) => [m.id, m]));
  assertEquals({ url: by.get(ids[0])!.url, is_affiliate: by.get(ids[0])!.is_affiliate, price_basis: by.get(ids[0])!.price_basis, prep_load: by.get(ids[0])!.prep_load }, { url: 'https://aff0.test', is_affiliate: true, price_basis: 'Per family per year', prep_load: 'open_and_go' });
  assertEquals(by.get(ids[1])!.price_cents, 0);
  assertEquals(by.get(ids[1])!.prep_load, 'light');
  // No display row (e.g. cut since the snapshot): no link, nothing invented.
  assertEquals({ url: by.get(ids[2])!.url, is_affiliate: by.get(ids[2])!.is_affiliate, price_cents: by.get(ids[2])!.price_cents, price_basis: by.get(ids[2])!.price_basis, prep_load: by.get(ids[2])!.prep_load },
    { url: null, is_affiliate: false, price_cents: null, price_basis: null, prep_load: '' });
});

// ── 2. Helpful extras ────────────────────────────────────────────────────────

Deno.test('isHelpfulExtra: a set type other than "Curriculum" (same rule as the finder); no type = a curriculum', () => {
  assert(isHelpfulExtra({ resource_type: 'App' }));
  assert(isHelpfulExtra({ resource_type: 'Video library' }));
  assert(!isHelpfulExtra({ resource_type: 'Curriculum' }));
  assert(!isHelpfulExtra({ resource_type: null }));
  assert(!isHelpfulExtra({}));
});

Deno.test('extras: only approved, not coming soon, non-curriculum rows that serve one of the top 3; at most 3', () => {
  const rows = [
    extra({ name: 'A curriculum', resource_type: 'Curriculum' }),
    extra({ name: 'Old row', resource_type: null }),
    extra({ name: 'Not approved', approved: false }),
    extra({ name: 'Coming soon', coming_soon: true }),
    extra({ name: 'Wrong wiring', domains_served: ['Seeker'] }),
    extra({ name: 'One' }), extra({ name: 'Two' }), extra({ name: 'Three' }), extra({ name: 'Four' }),
  ];
  const out = pickHelpfulExtras({ grade: 2, scores: CHILD, top3: TOP3, prefs: prefs(), rows });
  assertEquals(EXTRAS_LIMIT, 3);
  assertEquals(out.map((x) => x.name), ['Four', 'One', 'Three']); // same wiring share: alphabetical
});

Deno.test('extras: ordered by how much of the top-3 score they serve, then name', () => {
  const rows = [
    extra({ name: 'Cultivator only', domains_served: ['Cultivator'] }),
    extra({ name: 'Maker + Designer', domains_served: ['Maker', 'Designer'] }),
    extra({ name: 'All three', domains_served: ['Maker', 'Designer', 'Cultivator'] }),
  ];
  assertEquals(pickHelpfulExtras({ grade: 2, scores: CHILD, top3: TOP3, prefs: prefs(), rows }).map((x) => x.name), ['All three', 'Maker + Designer', 'Cultivator only']);
});

Deno.test('extras: blank grades = any grade; a set grade follows the +/- 1 rule; a half-blank range is open on that side', () => {
  const rows = [
    extra({ name: 'Any grade' }),
    extra({ name: 'K-1', grade_min: 0, grade_max: 1 }),
    extra({ name: '6-12', grade_min: 6, grade_max: 12 }),
    extra({ name: 'Up to 12', grade_min: null, grade_max: 12 }),
  ];
  assertEquals(pickHelpfulExtras({ grade: 2, scores: CHILD, top3: TOP3, prefs: prefs(), rows, limit: 10 }).map((x) => x.name), ['Any grade', 'K-1', 'Up to 12']);
  assertEquals(pickHelpfulExtras({ grade: 9, scores: CHILD, top3: TOP3, prefs: prefs(), rows, limit: 10 }).map((x) => x.name), ['6-12', 'Any grade', 'Up to 12']);
});

Deno.test('extras: her Christian / ESA / budget filters apply; with no box ticked they do not', () => {
  const tn = uuid();
  const rows = [
    extra({ name: 'Christian', faith_alignment: 'Christian (explicit)', price_cents: 50_000 }),
    extra({ name: 'Secular', price_cents: 1000 }),
    extra({ id: tn, name: 'ESA in TN', price_cents: null }),
  ];
  const esa = [{ curriculum_id: tn, state: 'TN', eligible: 'yes', verified_at: '2026-11-19' }];
  const pick = (f: Record<string, unknown>, budget = '100_300') => pickHelpfulExtras({ grade: 2, scores: CHILD, top3: TOP3, prefs: prefs(f, budget), rows, esa }).map((x) => x.name);
  assertEquals(pick({}), ['Christian', 'ESA in TN', 'Secular']);
  assertEquals(pick({ christianOnly: true }), ['Christian']);
  assertEquals(pick({ esaOnly: true, state: 'tn' }), ['ESA in TN']);
  assertEquals(pick({ withinBudget: true }), ['Secular']);              // over budget and unknown price drop
  assertEquals(pick({ withinBudget: true }, 'unsure'), ['Christian', 'ESA in TN', 'Secular']); // no budget = no budget filter
});

Deno.test('extras: affiliate status never changes which extras show or their order (spec rule 3)', () => {
  const rows = Array.from({ length: 8 }, (_, i) => extra({ name: `E${i}`, domains_served: i % 2 ? ['Maker'] : ['Designer', 'Maker'] }));
  const base = pickHelpfulExtras({ grade: 2, scores: CHILD, top3: TOP3, prefs: prefs(), rows }).map((x) => x.id);
  for (let mask = 0; mask < 16; mask++) {
    const flipped = rows.map((r, i) => ({ ...r, is_affiliate: !!(mask & (1 << (i % 4))), affiliate_url: mask & (1 << (i % 4)) ? 'https://aff.test' : null }));
    assertEquals(pickHelpfulExtras({ grade: 2, scores: CHILD, top3: TOP3, prefs: prefs(), rows: flipped }).map((x) => x.id), base);
  }
});

Deno.test('extras: each shows its type label as stored, Screen-based only when Yes, and the finder link rule', () => {
  const rows = [
    extra({ name: 'Songs', resource_type: 'Songs', screen_based: false, domains_served: ['Maker', 'Designer'] }),
    extra({ name: 'Video', resource_type: 'Video library', screen_based: null, url: 'https://v.test', affiliate_url: 'https://aff.test', is_affiliate: true }),
  ];
  const [a, b] = pickHelpfulExtras({ grade: 2, scores: CHILD, top3: TOP3, prefs: prefs(), rows });
  assertEquals({ name: a.name, type: a.resource_type, screen: a.screen_based, url: a.url, aff: a.is_affiliate }, { name: 'Songs', type: 'Songs', screen: false, url: 'https://example.com/x', aff: false });
  assertEquals({ name: b.name, type: b.resource_type, screen: b.screen_based, url: b.url, aff: b.is_affiliate }, { name: 'Video', type: 'Video library', screen: false, url: 'https://aff.test', aff: true });
});

// ── 3. The later $28 upgrade ─────────────────────────────────────────────────

const O1 = '00000000-0000-4000-8000-0000000000a1';
const O2 = '00000000-0000-4000-8000-0000000000a2';
const K1 = '00000000-0000-4000-8000-0000000000b1';
const K2 = '00000000-0000-4000-8000-0000000000b2';
const nicks = new Map([[K1, 'Lily'], [K2, 'Ben']]);
const unlocks = [{ order_id: O1, child_id: K1 }, { order_id: O2, child_id: K2 }];
const buy = (product: string, order_id: string, over: Record<string, string | null> = {}) =>
  ({ product, order_id, refunded_at: null, disputed_at: null, purchased_at: '2026-11-20T10:00:00Z', ...over });

Deno.test('upgrade: a live Blueprint this quiz year names its child', () => {
  assertEquals(familyMapUpgrade([buy('blueprint', O1)], unlocks, nicks), { blueprint_nickname: 'Lily' });
});

Deno.test('upgrade: none without a Blueprint, or when it was refunded or disputed', () => {
  assertEquals(familyMapUpgrade([], unlocks, nicks), null);
  assertEquals(familyMapUpgrade([buy('blueprint', O1, { refunded_at: '2026-11-21' })], unlocks, nicks), null);
  assertEquals(familyMapUpgrade([buy('blueprint', O1, { disputed_at: '2026-11-21' })], unlocks, nicks), null);
});

Deno.test('upgrade: none once a Family Map is owned (any Family Map product), unless that one was refunded', () => {
  for (const p of ['family_map', 'blueprint_upgrade', 'family_map_upgrade']) {
    assertEquals(familyMapUpgrade([buy('blueprint', O1), buy(p, O2)], unlocks, nicks), null, p);
  }
  assertEquals(familyMapUpgrade([buy('blueprint', O1), buy('family_map', O2, { refunded_at: '2026-11-21' })], unlocks, nicks), { blueprint_nickname: 'Lily' });
});

Deno.test('upgrade: two Blueprints name the earliest; a Blueprint whose child cannot be named is skipped', () => {
  assertEquals(familyMapUpgrade([buy('blueprint', O2, { purchased_at: '2026-11-21T00:00:00Z' }), buy('blueprint', O1, { purchased_at: '2026-11-19T00:00:00Z' })], unlocks, nicks), { blueprint_nickname: 'Lily' });
  assertEquals(familyMapUpgrade([buy('blueprint', O1)], unlocks, new Map([[K2, 'Ben']])), null);
  assertEquals(familyMapUpgrade([buy('blueprint', O1), buy('blueprint', O2)], unlocks, new Map([[K2, 'Ben']])), { blueprint_nickname: 'Ben' });
});

// ── I/O: the reads (fake PostgREST) ──────────────────────────────────────────

function fakeDb(routes: (path: string) => unknown): { seen: string[]; restore: () => void } {
  const seen: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push(url);
    const path = url.split('/rest/v1/')[1] ?? '';
    return Promise.resolve(new Response(JSON.stringify(routes(path) ?? []), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }) as typeof fetch;
  return { seen, restore: () => (globalThis.fetch = real) };
}
const DB = { url: 'https://db.test', key: 'k' };
const FAM = '00000000-0000-4000-8000-0000000000f1';

Deno.test('familyMapUpgradeFor: reads this quiz year\'s buyers, the Blueprint unlocks and the child, family-scoped', async () => {
  const now = new Date('2026-11-21T15:00:00Z');
  const f = fakeDb((p) => {
    if (p.startsWith('wired_buyers?')) return [buy('blueprint', O1)];
    if (p.startsWith('wired_unlocks?')) return [{ order_id: O1, child_id: K1 }];
    if (p.startsWith('wired_children?')) return [{ id: K1, nickname: 'Lily' }];
  });
  try {
    assertEquals(await familyMapUpgradeFor(DB, FAM, now), { blueprint_nickname: 'Lily' });
  } finally {
    f.restore();
  }
  assertStringIncludes(f.seen[0], `wired_buyers?family_id=eq.${FAM}&quiz_year=eq.${quizYear(now)}&`);
  assertStringIncludes(f.seen[1], `wired_unlocks?family_id=eq.${FAM}&order_id=in.(${O1})&product=eq.blueprint`);
  assertStringIncludes(f.seen[2], `wired_children?family_id=eq.${FAM}&id=in.(${K1})`);
});

Deno.test('familyMapUpgradeFor: a family with a Family Map stops after the buyers read', async () => {
  const f = fakeDb((p) => (p.startsWith('wired_buyers?') ? [buy('blueprint', O1), buy('family_map', O2)] : []));
  try {
    assertEquals(await familyMapUpgradeFor(DB, FAM), null);
  } finally {
    f.restore();
  }
  assertEquals(f.seen.length, 1);
});

Deno.test('matchDisplayRows / helpfulExtraRows: approved rows only; display by id; extras = resource_type is not Curriculum', async () => {
  const f = fakeDb(() => []);
  try {
    assertEquals(await matchDisplayRows(DB, []), []);
    await matchDisplayRows(DB, [K1, K1, 'not-a-uuid', K2]);
    await helpfulExtraRows(DB);
  } finally {
    f.restore();
  }
  assertEquals(f.seen.length, 2, 'no ids = no read');
  assertStringIncludes(f.seen[0], `wired_curricula?id=in.(${K1},${K2})&approved=eq.true&select=id,url,affiliate_url,is_affiliate,price_cents,price_basis,prep_load`);
  assertStringIncludes(f.seen[1], 'wired_curricula?approved=eq.true&coming_soon=eq.false&resource_type=neq.Curriculum&select=');
});
