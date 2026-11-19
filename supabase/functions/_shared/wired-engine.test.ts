// deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/wired-engine.test.ts
//
// Wired quiz W2: banks, scoring, ties, Renaissance, blend weights, teaching style, grade
// bands and the quiz year. The six approved banks are validated as shipped.

import { assert, assertAlmostEquals, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  AnswerError,
  type Bank,
  blend,
  DOMAINS,
  type Domain,
  isRenaissance,
  publicBank,
  quizYear,
  rankDomains,
  type Scores,
  scoreRater,
  scoreTeachingStyle,
  setKindForGrade,
  validateBank,
} from './wired-engine.ts';

const BANK_FILES = ['k2-v1', 'g35-v1', 'g68-v1', 'g912-v1', 'teen-v1', 'adult-v1'];
async function loadBank(v: string): Promise<Bank> {
  return JSON.parse(await Deno.readTextFile(new URL(`./wired-banks/${v}.json`, import.meta.url)));
}

/** A tiny valid bank: 3 scenarios covering each wiring once, 9 frequency items. */
function tinyBank(): Bank {
  const d = DOMAINS;
  return {
    version: 'tiny-v1', set_kind: 'k2', instructions: 'i', frequency_stem: 'f',
    scale: { points: 5, labels: ['1', '2', '3', '4', '5'] },
    weights: { scenario: 0.5, frequency: 0.5 },
    scenarios: [0, 1, 2].map((i) => ({
      id: `t-s${i}`, prompt: 'p',
      options: [0, 1, 2].map((j) => ({ id: `t-s${i}-${j}`, domain: d[i * 3 + j], text: 'x' })),
    })),
    frequency: d.map((dom, i) => ({ id: `t-f${i}`, domain: dom, text: 'x' })),
  };
}
const scoresOf = (pairs: Partial<Record<Domain, number>>): Scores =>
  Object.fromEntries(DOMAINS.map((d) => [d, pairs[d] ?? 0])) as Scores;

// ── the approved banks ──
Deno.test('all six approved banks validate clean (equal exposure, balanced grid, one frequency item per wiring)', async () => {
  for (const v of BANK_FILES) {
    const b = await loadBank(v);
    assertEquals(validateBank(b), [], v);
    assertEquals(b.version, v);
    assertEquals(b.scenarios.length, 12, v);
    assertEquals(b.frequency.length, 9, v);
  }
});

Deno.test('all child, teen and adult banks use the same 12 wiring triples in the same order (answer 23)', async () => {
  const triples = async (v: string) => (await loadBank(v)).scenarios.map((s) => s.options.map((o) => o.domain).join(','));
  const k2 = await triples('k2-v1');
  for (const v of BANK_FILES.slice(1)) assertEquals(await triples(v), k2, v);
});

Deno.test('adult bank: 4 teaching-style dimensions x 3 two-ended items, 5 labelled points', async () => {
  const b = await loadBank('adult-v1');
  assertEquals(b.teaching_style?.dimensions.map((d) => d.key), ['structure', 'planning', 'capacity', 'resistance']);
  assertEquals(b.teaching_style?.scale.labels.length, 5);
});

// ── validation catches the unsafe banks ──
Deno.test('validateBank: unequal exposure, missing wiring, duplicate ids, bad weights, adult without teaching style', () => {
  const uneven = tinyBank();
  uneven.scenarios[0].options[0].domain = 'organizer';   // storyteller 0, organizer 2
  assert(validateBank(uneven).some((e) => e.includes('unequal exposure') || e.includes('twice')));

  const dup = tinyBank();
  dup.frequency[1].id = dup.frequency[0].id;
  assert(validateBank(dup).some((e) => e.includes('duplicate id')));

  const w = tinyBank();
  w.weights = { scenario: 0.7, frequency: 0.5 };
  assert(validateBank(w).some((e) => e.includes('weights')));

  const f = tinyBank();
  f.frequency = f.frequency.slice(0, 8);
  assert(validateBank(f).some((e) => e.includes('frequency items')));

  const a = tinyBank();
  a.set_kind = 'adult';
  assert(validateBank(a).some((e) => e.includes('teaching_style')));

  assertEquals(validateBank(tinyBank()), []);
});

Deno.test('scoreRater refuses to score against an invalid bank', () => {
  const b = tinyBank();
  b.weights = { scenario: 1, frequency: 1 };
  assertThrows(() => scoreRater(b, { scenarios: {}, frequency: {} }), Error, 'invalid');
});

// ── what the browser sees ──
Deno.test('publicBank strips every scoring key and shuffles options per call', async () => {
  const b = await loadBank('adult-v1');
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const p = publicBank(b, rand);
  const s = JSON.stringify(p);
  assert(!s.includes('"domain"'), 'no domain field');
  assert(!s.includes('"weights"'), 'no weights');
  assert(!s.includes('"dimensions"') && !s.includes('"key"'), 'no teaching dimension keys');
  for (const d of DOMAINS) assert(!s.includes(`"${d}"`), `no ${d} value`);
  assertEquals(p.scenarios.length, 12);
  for (let i = 0; i < 12; i++) {
    assertEquals(p.scenarios[i].options.map((o) => o.id).sort(), b.scenarios[i].options.map((o) => o.id).sort());
  }
  const moved = p.scenarios.some((s, i) => s.options.map((o) => o.id).join() !== b.scenarios[i].options.map((o) => o.id).join());
  assert(moved, 'at least one scenario reordered');
  assertEquals(p.teaching_style?.items.length, 12);
});

// ── scoring ──
Deno.test('scoreRater: the section 5 formula, exactly', () => {
  const b = tinyBank();
  // picks: storyteller (s0), maker (s1), cultivator (s2); frequency ratings 5,4,3,2,1,1,1,1,1
  const r = scoreRater(b, {
    scenarios: { 't-s0': 't-s0-0', 't-s1': 't-s1-0', 't-s2': 't-s2-1' },
    frequency: { 't-f0': 5, 't-f1': 4, 't-f2': 3, 't-f3': 2, 't-f4': 1, 't-f5': 1, 't-f6': 1, 't-f7': 1, 't-f8': 1 },
  });
  // storyteller: 0.5*1 + 0.5*1 = 100; organizer: 0 + 0.5*0.75 = 38 (37.5 rounds to 38);
  // designer: 0.5*0.5 = 25; maker: 0.5*1 + 0.5*0.25 = 63 (62.5); cultivator: 50; others 0
  assertEquals(r.scores.storyteller, 100);
  assertEquals(r.scores.organizer, 38);
  assertEquals(r.scores.designer, 25);
  assertEquals(r.scores.maker, 63);
  assertEquals(r.scores.cultivator, 50);
  assertEquals(r.scores.seeker, 0);
  assertEquals(r.top3, ['storyteller', 'maker', 'cultivator']);
  assertEquals(r.renaissance, false);
  assertEquals(r.bank_version, 'tiny-v1');
});

Deno.test('scoreRater: incomplete or invalid answers throw AnswerError (nothing scored)', () => {
  const b = tinyBank();
  const full = {
    scenarios: { 't-s0': 't-s0-0', 't-s1': 't-s1-0', 't-s2': 't-s2-0' },
    frequency: Object.fromEntries(b.frequency.map((f) => [f.id, 3])),
  };
  scoreRater(b, full);
  assertThrows(() => scoreRater(b, { ...full, scenarios: { 't-s0': 't-s0-0', 't-s1': 't-s1-0' } }), AnswerError);
  assertThrows(() => scoreRater(b, { ...full, scenarios: { ...full.scenarios, 't-s2': 't-s0-0' } }), AnswerError);
  assertThrows(() => scoreRater(b, { ...full, frequency: { ...full.frequency, 't-f0': 6 } }), AnswerError);
  assertThrows(() => scoreRater(b, { ...full, frequency: { ...full.frequency, 't-f0': 2.5 } }), AnswerError);
  assertThrows(() => scoreRater(b, { ...full, scenarios: { ...full.scenarios, 'bogus': 'x' } }), AnswerError);
});

Deno.test('scoreRater on a real approved bank: 21 answers in, 9 scores 0-100 and a top 3 out', async () => {
  const b = await loadBank('k2-v1');
  const r = scoreRater(b, {
    scenarios: Object.fromEntries(b.scenarios.map((s) => [s.id, s.options[s.options.length - 1].id])),
    frequency: Object.fromEntries(b.frequency.map((f, i) => [f.id, (i % 5) + 1])),
  });
  for (const d of DOMAINS) assert(r.scores[d] >= 0 && r.scores[d] <= 100);
  assertEquals(r.top3.length, 3);
  assertEquals(new Set(r.top3).size, 3);
});

Deno.test('ties: frequency component first, then the fixed domain order', () => {
  const s = scoresOf({ storyteller: 70, organizer: 70, designer: 70 });
  const f = scoresOf({ organizer: 0.75, designer: 0.75, storyteller: 0.5 });
  assertEquals(rankDomains(s, f).slice(0, 3), ['organizer', 'designer', 'storyteller']);
});

Deno.test('Renaissance: top five within 10 points of each other', () => {
  assertEquals(isRenaissance(scoresOf({ storyteller: 80, organizer: 78, designer: 75, maker: 72, psalmist: 70, connector: 10 })), true);
  assertEquals(isRenaissance(scoresOf({ storyteller: 80, organizer: 78, designer: 75, maker: 72, psalmist: 69 })), false);
});

// ── blend ──
Deno.test('blend: mom alone = mom; mom + teen + 2 observers = 50 / 16.7 / 16.7 / 16.7', () => {
  const r = (v: number) => ({ scores: scoresOf({ storyteller: v }), frequency: scoresOf({}) });
  const alone = blend([{ role: 'mom', session_id: 'm', result: r(60) }]);
  assertEquals(alone.weights, { m: 1 });
  assertEquals(alone.blended_scores.storyteller, 60);

  const four = blend([
    { role: 'mom', session_id: 'm', result: r(60) },
    { role: 'teen', session_id: 't', result: r(90) },
    { role: 'observer', session_id: 'o1', result: r(30) },
    { role: 'observer', session_id: 'o2', result: r(0) },
  ]);
  assertEquals(four.weights.m, 0.5);
  for (const k of ['t', 'o1', 'o2']) assertAlmostEquals(four.weights[k], 1 / 6, 1e-12);
  // 0.5*60 + (90+30+0)/6 = 30 + 20 = 50
  assertEquals(four.blended_scores.storyteller, 50);
  assertEquals(four.session_ids, ['m', 't', 'o1', 'o2']);
  assertThrows(() => blend([]), Error);
  assertThrows(() => blend([{ role: 'mom', session_id: 'a', result: r(1) }, { role: 'mom', session_id: 'b', result: r(1) }]), Error);
});

// ── teaching style ──
Deno.test('teaching style: mean of 3 scaled 0-100; 0-30 left, 31-69 balance, 70-100 right', async () => {
  const b = await loadBank('adult-v1');
  const ans = (st: number[], pl: number[], ca: number[], re: number[]) => ({
    'ts-st1': st[0], 'ts-st2': st[1], 'ts-st3': st[2], 'ts-pl1': pl[0], 'ts-pl2': pl[1], 'ts-pl3': pl[2],
    'ts-ca1': ca[0], 'ts-ca2': ca[1], 'ts-ca3': ca[2], 'ts-re1': re[0], 'ts-re2': re[1], 'ts-re3': re[2],
  });
  const r = scoreTeachingStyle(b, ans([1, 1, 1], [2, 2, 3], [4, 4, 4], [5, 5, 5]));
  assertEquals(r.map((x) => [x.key, x.score, x.band]), [
    ['structure', 0, 'left'], ['planning', 33, 'balance'], ['capacity', 75, 'right'], ['resistance', 100, 'right'],
  ]);
  assertEquals(r[0].label, 'leans toward a steady routine');
  assertEquals(r[1].label, 'a balance of both');
  assertEquals(r[3].label, 'leans toward steady follow-through');
  assertThrows(() => scoreTeachingStyle(b, ans([1, 1, 0], [2, 2, 3], [4, 4, 4], [5, 5, 5])), AnswerError);
});

// ── grade bands and quiz year ──
Deno.test('set from grade switches at 3, 6 and 9', () => {
  assertEquals([0, 2, 3, 5, 6, 8, 9, 12].map(setKindForGrade), ['k2', 'k2', 'g3_5', 'g3_5', 'g6_8', 'g6_8', 'g9_12', 'g9_12']);
  assertThrows(() => setKindForGrade(13), RangeError);
  assertThrows(() => setKindForGrade(-1), RangeError);
});

Deno.test('quiz year starts July 1 in America/Chicago', () => {
  assertEquals(quizYear(new Date('2026-07-01T05:00:00Z')), 2026);   // Jul 1 00:00 CDT
  assertEquals(quizYear(new Date('2026-07-01T04:59:00Z')), 2025);   // Jun 30 23:59 CDT
  assertEquals(quizYear(new Date('2026-11-19T15:00:00Z')), 2026);
  assertEquals(quizYear(new Date('2027-06-30T23:00:00Z')), 2026);
});
