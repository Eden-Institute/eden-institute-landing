// deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/wired-match.test.ts
//
// Wired quiz W2: matching (spec section 6 + answer 25): ROC weights, default order,
// grade +/- 1, the four components, filters, coming-soon rows, ties, and the hard rule
// that affiliate status can never change a ranking. The planning-year rule (2026-11-22) is in wired-plan-year.test.ts.

import { assert, assertAlmostEquals, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DOMAINS, type Domain, type Scores } from './wired-engine.ts';
import {
  budgetComponent,
  DEFAULT_RANKING,
  esaEligible,
  gradeFits,
  type MatchCurriculum,
  type MatchInput,
  prepComponent,
  rankCurricula,
  resolveRanking,
  ROC_WEIGHTS,
  siblingsComponent,
  toMatchCurriculum,
  wiringComponent,
} from './wired-match.ts';

const scores = (p: Partial<Record<Domain, number>>): Scores => Object.fromEntries(DOMAINS.map((d) => [d, p[d] ?? 0])) as Scores;
const CHILD = scores({ maker: 80, designer: 70, cultivator: 50, storyteller: 20 });
const TOP3: Domain[] = ['maker', 'designer', 'cultivator'];

// deno-lint-ignore no-explicit-any
function row(over: Record<string, any> = {}) {
  return {
    id: over.id ?? crypto.randomUUID(), name: 'Curriculum', grade_min: 0, grade_max: 5,
    domains_served: ['Maker', 'Designer'], prep_load: 'Open-and-go', price_cents: 20_000, multi_age: true,
    faith_alignment: 'Christian (explicit)', approved: true, coming_soon: false, eden_band: null,
    is_affiliate: false, affiliate_url: null, dm_email: 'founder-only@example.com', ...over,
  };
}
function input(curricula: MatchCurriculum[], over: Partial<MatchInput> = {}): MatchInput {
  return {
    grade: 2, scores: CHILD, top3: TOP3, curricula,
    prefs: { kids: '2', prep: 'light', budget: '100_300', ranking: null, filters: {} }, ...over,
  };
}

Deno.test('ROC weights 0.5208 / 0.2708 / 0.1458 / 0.0625, summing to 1', () => {
  [0.5208, 0.2708, 0.1458, 0.0625].forEach((w, i) => assertAlmostEquals(ROC_WEIGHTS[i], w, 1e-4));
  assertAlmostEquals(ROC_WEIGHTS.reduce((a, b) => a + b, 0), 1, 1e-12);
});

Deno.test('ranking: skipped/invalid = wiring > prep > budget > siblings; a 3-item tap order gets siblings last', () => {
  assertEquals(resolveRanking(null), ['wiring', 'prep', 'budget', 'siblings']);
  assertEquals(DEFAULT_RANKING, ['wiring', 'prep', 'budget', 'siblings']);
  assertEquals(resolveRanking(['budget', 'wiring', 'prep', 'siblings']), ['budget', 'wiring', 'prep', 'siblings']);
  assertEquals(resolveRanking(['prep', 'budget', 'wiring']), ['prep', 'budget', 'wiring', 'siblings']);
  assertEquals(resolveRanking(['prep', 'prep', 'wiring', 'budget']), DEFAULT_RANKING);
  assertEquals(resolveRanking(['nope']), DEFAULT_RANKING);
});

Deno.test('grade range includes the child grade +/- 1', () => {
  const c = toMatchCurriculum(row({ grade_min: 3, grade_max: 5 }));
  assertEquals([1, 2, 3, 5, 6, 7].map((g) => gradeFits(c, g)), [false, true, true, true, true, false]);
  assertEquals(gradeFits(toMatchCurriculum(row({ grade_min: null })), 2), false);
});

Deno.test('components: wiring, budget bounds, prep steps, siblings', () => {
  const c = toMatchCurriculum(row());
  const w = wiringComponent(c, CHILD, TOP3);
  assertAlmostEquals(w.value, (80 + 70) / (80 + 70 + 50), 1e-12);
  assertEquals(w.served, ['maker', 'designer']);

  const price = (cents: number | null) => toMatchCurriculum(row({ price_cents: cents }));
  assertEquals(budgetComponent(price(10_000), 'under_100'), 1);
  assertEquals(budgetComponent(price(12_500), 'under_100'), 0.5);
  assertEquals(budgetComponent(price(12_501), 'under_100'), 0);
  assertEquals(budgetComponent(price(0), 'free'), 1);
  assertEquals(budgetComponent(price(1), 'free'), 0);
  assertEquals(budgetComponent(price(500_000), 'over_1000'), 1);
  assertEquals(budgetComponent(price(500_000), 'unsure'), 1);
  assertEquals(budgetComponent(price(null), '100_300'), 0);

  const prep = (p: string) => toMatchCurriculum(row({ prep_load: p }));
  assertEquals(prepComponent(prep('Open-and-go'), 'light'), 1);
  assertEquals(prepComponent(prep('Light'), 'light'), 1);
  assertEquals(prepComponent(prep('Moderate'), 'light'), 0.5);
  assertEquals(prepComponent(prep('Heavy'), 'light'), 0);
  assertEquals(prepComponent(prep(''), 'light'), 0.5); // no level recorded = neutral (answer 34)
  assertEquals(prepComponent(prep(''), 'heavy'), 0.5);

  assertEquals(siblingsComponent(toMatchCurriculum(row({ multi_age: false })), '1'), 1);
  assertEquals(siblingsComponent(toMatchCurriculum(row({ multi_age: false })), '3'), 0.3);
  assertEquals(siblingsComponent(toMatchCurriculum(row({ multi_age: true })), '5plus'), 1);
});

Deno.test('🛑 affiliate status never changes a ranking (rule 3): flipping every flag leaves the output identical', () => {
  const base = [
    row({ id: 'a', name: 'Alpha', domains_served: ['Maker'], price_cents: 25_000 }),
    row({ id: 'b', name: 'Beta', domains_served: ['Designer', 'Cultivator'], prep_load: 'Moderate' }),
    row({ id: 'c', name: 'Gamma', domains_served: ['Storyteller'], multi_age: false }),
    row({ id: 'd', name: 'Delta', domains_served: ['Maker', 'Designer', 'Cultivator'], price_cents: 90_000 }),
  ];
  const flipped = base.map((r, i) => ({ ...r, is_affiliate: i % 2 === 0, affiliate_url: i % 2 === 0 ? 'https://aff.example/x' : null }));
  const allOn = base.map((r) => ({ ...r, is_affiliate: true, affiliate_url: 'https://aff.example/y' }));
  // deno-lint-ignore no-explicit-any
  const out = (rows: Record<string, any>[]) => rankCurricula(input(rows.map(toMatchCurriculum), { limit: 10 }));
  assertEquals(out(flipped), out(base));
  assertEquals(out(allOn), out(base));
  // and the projection never carries the field (nor the founder-only outreach fields)
  const projected = JSON.stringify(base.map(toMatchCurriculum));
  assert(!projected.includes('affiliate') && !projected.includes('dm_') && !projected.includes('founder-only'));
});

Deno.test('ranking: weights x components, highest first; "because" names the two largest contributions', () => {
  const out = rankCurricula(input([
    toMatchCurriculum(row({ id: 'a', name: 'Alpha', domains_served: ['Maker', 'Designer', 'Cultivator'], prep_load: 'Heavy' })),
    toMatchCurriculum(row({ id: 'b', name: 'Beta', domains_served: ['Storyteller'], prep_load: 'Open-and-go' })),
  ]));
  // default ranking: wiring .5208, prep .2708, budget .1458, siblings .0625
  // Alpha: wiring 1, prep 0 (heavy vs light), budget 1, siblings 1 -> .5208 + .1458 + .0625 = .7292
  // Beta: wiring 0, prep 1, budget 1, siblings 1 -> .2708 + .1458 + .0625 = .4792
  assertEquals(out.matches.map((m) => m.id), ['a', 'b']);
  assertAlmostEquals(out.matches[0].score, 0.7292, 1e-4);
  assertAlmostEquals(out.matches[1].score, 0.4792, 1e-4);
  assertEquals(out.matches[0].because, ['wiring', 'budget']);
  assertEquals(out.matches[1].because, ['prep', 'budget']);
  assertEquals(out.matches[0].served_top3, ['maker', 'designer', 'cultivator']);
});

Deno.test('reasons (answer 28c): no siblings reason for one child, no budget reason when unsure, ESA as a third when ticked', () => {
  const rows = [toMatchCurriculum(row({ id: 'a', name: 'Alpha', domains_served: ['Storyteller'], prep_load: 'Heavy' }))];
  // one child, budget unsure: contributions = wiring 0, prep 0, budget .1458, siblings .0625 -> neither may show
  const one = rankCurricula(input(rows, { prefs: { kids: '1', prep: 'light', budget: 'unsure' } }));
  assertEquals(one.matches[0].because, []);
  // two kids, stated budget: budget + siblings may show
  const two = rankCurricula(input(rows, { prefs: { kids: '2', prep: 'light', budget: '100_300' } }));
  assertEquals(two.matches[0].because, ['budget', 'siblings']);
  // unknown price never gives a budget reason
  const nullPrice = [toMatchCurriculum(row({ id: 'n', name: 'NoPrice', price_cents: null }))];
  assert(!rankCurricula(input(nullPrice)).matches[0].because.includes('budget'));
  // ESA ticked with a state: 'esa' appended as a third reason
  const esa = [{ curriculum_id: 'a', state: 'TN', eligible: 'yes', verified_at: '2026-11-18' }];
  const withEsa = rankCurricula(input(rows, { esa, prefs: { kids: '2', prep: 'light', budget: '100_300', filters: { esaOnly: true, state: 'tn' } } }));
  assertEquals(withEsa.matches[0].because, ['budget', 'siblings', 'esa']);
  assertEquals(withEsa.matches[0].esa_state, 'TN');
});

Deno.test('answer 34: a curriculum with no prep level never shows a prep reason, even with prep ranked first', () => {
  const rows = [toMatchCurriculum(row({ id: 'n', name: 'NoPrep', prep_load: null, domains_served: ['Storyteller'] }))];
  const out = rankCurricula(input(rows, { prefs: { kids: '2', prep: 'light', budget: '100_300', ranking: ['prep', 'budget', 'wiring', 'siblings'] } }));
  assertEquals(out.matches[0].components.prep, 0.5);
  assert(!out.matches[0].because.includes('prep'));
  assertEquals(out.matches[0].because, ['budget', 'siblings']);
});

Deno.test('her ranking changes the order (budget first puts the cheaper one on top)', () => {
  const rows = [
    toMatchCurriculum(row({ id: 'a', name: 'Alpha', domains_served: ['Maker', 'Designer', 'Cultivator'], price_cents: 90_000 })),
    toMatchCurriculum(row({ id: 'b', name: 'Beta', domains_served: ['Maker'], price_cents: 10_000 })),
  ];
  assertEquals(rankCurricula(input(rows)).matches[0].id, 'a');
  const budgetFirst = rankCurricula(input(rows, { prefs: { kids: '2', prep: 'light', budget: '100_300', ranking: ['budget', 'wiring', 'prep', 'siblings'] } }));
  assertEquals(budgetFirst.matches[0].id, 'b');
});

Deno.test('ties: alphabetical by name, never by affiliate status', () => {
  const out = rankCurricula(input([
    toMatchCurriculum(row({ id: '1', name: 'zebra Studies', is_affiliate: true })),
    toMatchCurriculum(row({ id: '2', name: 'Apple Learning' })),
    toMatchCurriculum(row({ id: '3', name: 'mango Press' })),
  ]));
  assertEquals(out.matches.map((m) => m.name), ['Apple Learning', 'mango Press', 'zebra Studies']);
});

Deno.test('candidates: approved only, grade +/- 1, coming-soon rows listed outside the ranking, top 5 by default', () => {
  const rows = [
    ...Array.from({ length: 7 }, (_, i) => row({ id: `ok${i}`, name: `Ok ${i}` })),
    row({ id: 'draft', name: 'Draft', approved: false }),
    row({ id: 'old', name: 'Old', grade_min: 6, grade_max: 8 }),
    row({ id: 'eden', name: "Eden's Table K-2", grade_min: 0, grade_max: 2, coming_soon: true, eden_band: 'K-2 set' }),
    // 2026-11-22: a coming-soon set for the NEXT band is inside the +/- 1 window but is not this grade's own set
    row({ id: 'eden35', name: "Eden's Table 3-5", grade_min: 3, grade_max: 5, coming_soon: true, eden_band: '3-5 set' }),
  ];
  const out = rankCurricula(input(rows.map(toMatchCurriculum)));
  assertEquals(out.matches.length, 5);
  assert(out.matches.every((m) => m.id.startsWith('ok')));
  assertEquals(out.coming_soon, [{ name: "Eden's Table K-2", eden_band: 'K-2 set' }]);
  assertEquals(out.planning_grade, 2);
});

Deno.test('filters: within budget (not offered when unsure), Christian only, ESA eligible in her state', () => {
  const rows = [
    row({ id: 'cheap', name: 'Cheap', price_cents: 5_000 }),
    row({ id: 'pricey', name: 'Pricey', price_cents: 200_000 }),
    row({ id: 'secular', name: 'Secular', faith_alignment: 'Secular / neutral' }),
  ].map(toMatchCurriculum);
  const ids = (o: ReturnType<typeof rankCurricula>) => o.matches.map((m) => m.id).sort();

  assertEquals(ids(rankCurricula(input(rows, { prefs: { kids: '1', prep: 'light', budget: '100_300', filters: { withinBudget: true } } }))), ['cheap', 'secular']);
  const unsure = rankCurricula(input(rows, { prefs: { kids: '1', prep: 'light', budget: 'unsure', filters: { withinBudget: true } } }));
  assertEquals(unsure.budget_filter_offered, false);
  assertEquals(ids(unsure), ['cheap', 'pricey', 'secular']);
  assertEquals(ids(rankCurricula(input(rows, { prefs: { kids: '1', prep: 'light', budget: 'unsure', filters: { christianOnly: true } } }))), ['cheap', 'pricey']);

  const esa = [
    { curriculum_id: 'cheap', state: 'FL', eligible: 'yes', verified_at: '2026-11-18' },
    { curriculum_id: 'pricey', state: 'FL', eligible: 'yes', verified_at: null },       // no verified date: out
    { curriculum_id: 'secular', state: 'FL', eligible: 'unknown', verified_at: '2026-11-18' }, // unknown = not eligible
  ];
  assertEquals(ids(rankCurricula(input(rows, { esa, prefs: { kids: '1', prep: 'light', budget: 'unsure', filters: { esaOnly: true, state: 'fl' } } }))), ['cheap']);
  assertEquals(esaEligible('cheap', null, esa), false);
});
