// deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/wired-plan-year.test.ts
//
// 2026-11-22 (Camila's tap "Use as written", Lane NP; copy: docs/wired-copy/Wired_Quiz_Family_Map_And_Screens.md,
// "Tell us about your child"): "Which school year are you choosing curriculum for?" This school year / Next school year.
//   - This school year (or skipped, or an answer from before the question) = matches fit her CURRENT grade +/- 1;
//     Next school year = grade + 1 (capped at 12) +/- 1. The question set still follows her current grade.
//   - The Eden's Table coming-soon line shows only when the PLANNING grade's OWN set is not ready (the fix: a 5th
//     grader used to see the grades 6-8 waitlist because any coming-soon set inside the +/- 1 window was listed).
//   - Stored as family_answers.plan_year ('this' | 'next'), with the raw answers; any other value is refused (400).
//   - Every place that ranks or shows coming-soon reads the same stored answer: the submit snapshot, a rater's
//     re-blend, the Blueprint / free PDF loader (and so the learner emails), the live re-rank, the Helpful extras.
// No network: a fake PostgREST, like the other wired tests.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DOMAINS, type Domain, type Scores } from './wired-engine.ts';
import { comingSoonFor, gradeFits, type MatchInput, planningGrade, rankCurricula, toMatchCurriculum } from './wired-match.ts';
import { parseSubmission, PLAN_YEARS, prefsFromAnswers } from './wired-submit-core.ts';
import { processSubmission } from './wired-submit-flow.ts';
import { processRaterSubmission, type RaterContext } from './wired-raters.ts';
import { loadBlueprintData, type PdfJob } from './wired-pdf-job.ts';
import { pickHelpfulExtras } from './wired-display.ts';

const scores = (p: Partial<Record<Domain, number>>): Scores => Object.fromEntries(DOMAINS.map((d) => [d, p[d] ?? 0])) as Scores;
const CHILD = scores({ maker: 80, designer: 70, cultivator: 50, storyteller: 20 });
const TOP3: Domain[] = ['maker', 'designer', 'cultivator'];

// The live coming-soon rows as they stand (read 2026-11-22): Sprouts K-2 and Seedlings 3-5 ready, 6-8 and 9-12 coming soon.
// deno-lint-ignore no-explicit-any
const cur = (id: string, name: string, grade_min: number, grade_max: number, over: Record<string, any> = {}) => ({
  id, name, grade_min, grade_max, domains_served: ['Maker', 'Designer'], prep_load: 'Open-and-go', price_cents: 20_000, multi_age: true,
  faith_alignment: 'Christian (explicit)', approved: true, coming_soon: false, eden_band: null, ...over,
});
const ROWS = [
  cur('sprouts', "Eden's Table: Sprouts (grades K-2) Printed Curriculum Set", 0, 2, { eden_band: 'Sprouts' }),
  cur('seedlings', "Eden's Table: Seedlings (grades 3-5) Printed Curriculum Set", 3, 5, { eden_band: 'Seedlings' }),
  cur('cs68', "Eden's Table: grades 6-8 set", 6, 8, { coming_soon: true, eden_band: '6-8 set' }),
  cur('cs912', "Eden's Table: grades 9-12 set", 9, 12, { coming_soon: true, eden_band: '9-12 set' }),
  cur('k4', 'Early Years Press', 0, 4),
  cur('m78', 'Middle Years Press', 7, 8),
  cur('h912', 'High School Press', 9, 12),
];
const CURRICULA = ROWS.map(toMatchCurriculum);
const CS68 = { name: "Eden's Table: grades 6-8 set", eden_band: '6-8 set' };
const CS912 = { name: "Eden's Table: grades 9-12 set", eden_band: '9-12 set' };

const FA = { kids: '2', prep: 'light', frustration: 'time', approach: 'charlotte_mason', budget: '100_300', esa: 'no' } as const;
function input(grade: number, plan_year?: unknown): MatchInput {
  return { grade, scores: CHILD, top3: TOP3, curricula: CURRICULA, limit: 50, prefs: { kids: '2', prep: 'light', budget: '100_300', ranking: null, filters: {}, ...(plan_year === undefined ? {} : { plan_year: plan_year as string }) } };
}
const ids = (o: ReturnType<typeof rankCurricula>) => o.matches.map((m) => m.id).sort();

// ── the rule ──
Deno.test('planningGrade: next = grade + 1 capped at 12; this / skipped / anything else = her current grade', () => {
  assertEquals(PLAN_YEARS, ['this', 'next']);
  assertEquals(planningGrade(5, 'next'), 6);
  assertEquals(planningGrade(5, 'this'), 5);
  assertEquals(planningGrade(5, undefined), 5);
  assertEquals(planningGrade(5, null), 5);
  assertEquals(planningGrade(5, 'NEXT'), 5, 'only the stored code counts');
  assertEquals(planningGrade(5, 1), 5);
  assertEquals(planningGrade(0, 'next'), 1, 'K planning next year = grade 1');
  assertEquals(planningGrade(11, 'next'), 12);
  assertEquals(planningGrade(12, 'next'), 12, 'a 12th grader planning next year stays at 12');
  assertEquals(planningGrade(12, 'this'), 12);
});

Deno.test('🛑 the founder\'s case: a grade 5 child, this school year, sees NO grades 6-8 waitlist line; next school year does', () => {
  const thisYear = rankCurricula(input(5, 'this'));
  assertEquals(thisYear.coming_soon, []);
  assertEquals(thisYear.planning_grade, 5);
  const skipped = rankCurricula(input(5));
  assertEquals(skipped.coming_soon, [], 'skipped = this school year');
  assertEquals(skipped, thisYear);
  const nextYear = rankCurricula(input(5, 'next'));
  assertEquals(nextYear.coming_soon, [CS68]);
  assertEquals(nextYear.planning_grade, 6);
});

Deno.test('matches: this school year = current grade +/- 1, next school year = grade + 1 +/- 1', () => {
  // grade 5 this year: window 4-6 (Seedlings 3-5, Early Years K-4); next year: window 5-7 (Seedlings, Middle Years 7-8)
  assertEquals(ids(rankCurricula(input(5, 'this'))), ['k4', 'seedlings']);
  assertEquals(ids(rankCurricula(input(5, 'next'))), ['m78', 'seedlings']);
  // the window itself is unchanged: +/- 1 around the grade it is given
  assertEquals([4, 5, 6, 7].map((g) => gradeFits(CURRICULA.find((c) => c.id === 'm78')!, g)), [false, false, true, true]);
  // coming-soon sets never enter the ranked list
  for (const g of [0, 3, 5, 6, 8, 9, 12]) for (const py of ['this', 'next']) {
    assert(!rankCurricula(input(g, py)).matches.some((m) => m.id === 'cs68' || m.id === 'cs912'));
  }
});

Deno.test('coming soon follows the planning grade\'s OWN set, never a neighbouring band in the +/- 1 window', () => {
  const cs = (g: number, py?: string) => rankCurricula(input(g, py)).coming_soon;
  // K-2 and 3-5 sets are ready: no line, this year or next, at the band edges too
  for (const g of [0, 1, 2, 3, 4]) assertEquals(cs(g, 'this'), [], `grade ${g} this year`);
  for (const g of [0, 1, 2, 3]) assertEquals(cs(g, 'next'), [], `grade ${g} next year`);
  assertEquals(cs(2, 'next'), [], 'a 2nd grader planning next year lands on Seedlings (ready)');
  assertEquals(cs(5, 'this'), []);
  assertEquals(cs(4, 'next'), []);
  // 6-8: its own line only (an 8th grader used to see the 9-12 line too)
  assertEquals(cs(6, 'this'), [CS68]);
  assertEquals(cs(8, 'this'), [CS68]);
  assertEquals(cs(7, 'next'), [CS68]);
  assertEquals(cs(8, 'next'), [CS912]);
  // 9-12: its own line only (a 9th grader used to see the 6-8 line too)
  assertEquals(cs(9, 'this'), [CS912]);
  assertEquals(cs(12, 'this'), [CS912]);
  // comingSoonFor is the same rule, for the results page's live read
  assertEquals(comingSoonFor(CURRICULA, 5), []);
  assertEquals(comingSoonFor(CURRICULA, 6), [CS68]);
  assertEquals(comingSoonFor(CURRICULA, 9), [CS912]);
  // an unapproved or ready row is never a coming-soon line
  assertEquals(comingSoonFor([toMatchCurriculum({ ...ROWS[2], approved: false })], 6), []);
  assertEquals(comingSoonFor([toMatchCurriculum({ ...ROWS[2], coming_soon: false })], 6), []);
});

Deno.test('a 12th grader planning next year stays at 12: the same output as this year', () => {
  assertEquals(rankCurricula(input(12, 'next')), rankCurricula(input(12, 'this')));
  assertEquals(rankCurricula(input(12, 'next')).planning_grade, 12);
});

// ── parsing + prefs ──
const good = (fa: Record<string, unknown> = FA) => ({
  email: 'mom@example.com', child: { nickname: 'Lily', grade: 5 }, bank_version: 'g35-v1',
  answers: { scenarios: { a: 'b' }, frequency: { c: 3 } }, family_answers: fa,
});

Deno.test('parseSubmission: plan_year this/next is kept with her family answers; absent or null = not stored (this year)', () => {
  for (const py of ['this', 'next'] as const) {
    const r = parseSubmission(good({ ...FA, plan_year: py }));
    assert(r.ok);
    if (!r.ok) return;
    assertEquals(r.value.family_answers, { ...FA, plan_year: py });
    assertEquals(r.value.child, { nickname: 'Lily', grade: 5 }, 'the grade stays her current grade');
    assertEquals(r.value.set_kind, 'g3_5', 'the question set follows her current grade');
  }
  for (const fa of [FA, { ...FA, plan_year: null }, { ...FA, plan_year: undefined }]) {
    const r = parseSubmission(good(fa));
    assert(r.ok);
    if (!r.ok) return;
    assertEquals(r.value.family_answers, FA);
    assert(!('plan_year' in (r.value.family_answers as Record<string, unknown>)));
  }
});

Deno.test('parseSubmission: any other plan_year is refused like any other bad family code (400)', () => {
  for (const py of ['later', 'NEXT', 'next ', '', 1, true, ['next'], { y: 'next' }]) {
    const r = parseSubmission(good({ ...FA, plan_year: py }));
    assert(!r.ok, JSON.stringify(py));
    if (r.ok) return;
    assertEquals(r.errors, ['family_answers: every question needs one of its codes']);
  }
  // her own (adult) set never carries family answers, and still parses
  const adult = parseSubmission({ email: 'm@e.co', set: 'adult', bank_version: 'adult-v1', answers: { scenarios: {}, frequency: {}, teaching: {} } });
  assert(adult.ok && adult.value.family_answers === null);
});

Deno.test('prefsFromAnswers carries plan_year (absent = null), so every caller ranks on the same planning grade', () => {
  assertEquals(prefsFromAnswers({ ...FA, plan_year: 'next' } as never, null).plan_year, 'next');
  assertEquals(prefsFromAnswers(FA as never, null).plan_year, null);
  assertEquals(rankCurricula({ ...input(5), prefs: prefsFromAnswers({ ...FA, plan_year: 'next' } as never, null) }).coming_soon, [CS68]);
  assertEquals(rankCurricula({ ...input(5), prefs: prefsFromAnswers(FA as never, null) }).coming_soon, []);
});

// ── the callers ──
const DB = { url: 'https://db', key: 'k' };
const FAM = '11111111-1111-4111-8111-111111111111';
const KID = '22222222-2222-4222-8222-222222222222';
type Seen = { path: string; method: string; body?: unknown };
type Handler = (path: string, method: string, body: unknown) => unknown;
function route(handler: Handler): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const path = decodeURIComponent(url.split('/rest/v1/')[1] ?? '');
    seen.push({ path, method, body });
    const v = handler(path, method, body);
    return Promise.resolve(new Response(v === undefined || v === null ? null : JSON.stringify(v), { status: v === undefined || v === null ? 204 : 200 }));
  }) as typeof fetch;
  return seen;
}
const G35 = JSON.parse(Deno.readTextFileSync(new URL('./wired-banks/g35-v1.json', import.meta.url)));
const answersFor = (bank: { scenarios: { id: string; options: { id: string }[] }[]; frequency: { id: string }[] }) => ({
  scenarios: Object.fromEntries(bank.scenarios.map((s) => [s.id, s.options[0].id])),
  frequency: Object.fromEntries(bank.frequency.map((f) => [f.id, 4])),
});

Deno.test('processSubmission: the stored family answers carry plan_year; the snapshot and the results she sees use the planning grade', async () => {
  for (const [py, want] of [['next', [CS68]], ['this', []], [undefined, []]] as const) {
    let rpcBody: Record<string, any> | null = null;
    route((p, m, body) => {
      if (p.startsWith('wired_question_banks?version=eq.g35-v1')) return [{ bank: G35 }];
      if (p.startsWith('wired_families?')) return [];
      if (p.startsWith('wired_curricula?')) return ROWS;
      if (p === 'rpc/wired_submit') { rpcBody = (body as { p: Record<string, any> }).p; return { status: 'ok', family_id: FAM, child_id: KID, unlocked: true }; }
      if (p.startsWith('wired_email_queue?') && m === 'GET') return [];
      return null;
    });
    const parsed = parseSubmission({ ...good(py ? { ...FA, plan_year: py } : FA), answers: answersFor(G35) });
    assert(parsed.ok);
    if (!parsed.ok) return;
    const out = await processSubmission(DB, parsed.value, { pepper: 'p'.repeat(40) });
    assertEquals(out.status, 'ok');
    const p = rpcBody!;
    assertEquals(p.family_answers, py ? { ...FA, plan_year: py } : FA, 'stored with her raw family answers');
    assertEquals(p.child, { nickname: 'Lily', grade: 5 }, 'the child keeps her current grade');
    assertEquals(p.results.matches_snapshot.coming_soon, want);
    assertEquals(p.results.matches_snapshot.planning_grade, py === 'next' ? 6 : 5);
    assertEquals(p.results.matches_snapshot.matches.map((x: { id: string }) => x.id).sort(), py === 'next' ? ['m78', 'seedlings'] : ['k4', 'seedlings']);
    const res = (out as { results?: { coming_soon?: unknown; grade?: number } }).results!;
    assertEquals(res.coming_soon, want);
    assertEquals(res.grade, 5);
  }
});

Deno.test('a rater finishing re-blends on mom\'s stored plan_year (the snapshot keeps her planning grade)', async () => {
  const momAnswers = answersFor(G35);
  for (const [py, want] of [['next', [CS68]], [undefined, []]] as const) {
    let rpcBody: Record<string, any> | null = null;
    route((p, m, b) => {
      if (p.startsWith('wired_question_banks?version=eq.g35-v1')) return [{ bank: G35 }];
      if (p.startsWith('wired_families?')) return [{ email: 'mom@example.com' }];
      if (p.startsWith('wired_sessions?')) return [{ id: 's-mom', rater_role: 'mom', bank_version: 'g35-v1', raw_answers: momAnswers, family_answers: py ? { ...FA, plan_year: py } : FA }];
      if (p.startsWith('wired_results?')) return [{ matches_snapshot: { ranking: null } }];
      if (p.startsWith('wired_family_prefs?')) return [];
      if (p.startsWith('wired_curricula?')) return ROWS;
      if (p.startsWith('rpc/wired_submit')) { rpcBody = (b as { p: Record<string, any> }).p; return { status: 'ok', session_id: 's-obs' }; }
      if (m === 'PATCH' || m === 'POST') return null;
      return [];
    });
    const ctx: RaterContext = { kind: 'observer', linkId: '33333333-3333-4333-8333-333333333333', familyId: FAM, childId: KID, nickname: 'Lily', grade: 5, quizYear: 2026, setKind: 'g3_5', momName: 'Sarah', label: 'Grandma' };
    const out = await processRaterSubmission(DB, ctx, 'g35-v1', answersFor(G35), new Date('2026-11-22T20:00:00Z'));
    assertEquals(out, { status: 'ok', sessionId: 's-obs' });
    assertEquals(rpcBody!.results.matches_snapshot.coming_soon, want);
    assertEquals(rpcBody!.child, { nickname: 'Lily', grade: 5 });
  }
});

function pdfWorld(grade: number, fa: Record<string, unknown>): Handler {
  return (p) => {
    if (p.startsWith('wired_families?')) return [{ id: FAM, email: 'mom@example.com', first_name: 'Sarah' }];
    if (p.startsWith('wired_children?')) return [{ id: KID, nickname: 'Lily', grade, created_at: '2026-08-01T00:00:00Z' }];
    if (p.startsWith('wired_family_prefs?') || p.startsWith('wired_family_results?')) return [];
    if (p.startsWith('wired_curricula?') && p.includes('select=id,url,')) return ROWS.map((r) => ({ id: r.id, url: `https://example.com/${r.id}`, affiliate_url: null, is_affiliate: false, subjects: ['Science'], price_cents: r.price_cents, prep_load: r.prep_load }));
    if (p.startsWith('wired_curricula?')) return ROWS;
    if (p.startsWith('wired_results?')) return [{ quiz_year: 2026, blended_scores: CHILD, top3: TOP3, computed_at: '2026-11-20T12:00:00Z', renaissance: false, matches_snapshot: null }];
    if (p.startsWith('wired_sessions?')) return [{ family_answers: fa, completed_at: '2026-11-20T12:00:00Z', rater_role: 'mom', observer_id: null, scores: CHILD, top3: TOP3, bank_version: 'g35-v1' }];
    return [];
  };
}
const freeJob: PdfJob = { id: 'j1', family_id: FAM, child_id: KID, order_id: null, buyer_id: null, kind: 'free', quiz_year: 0, attempts: 0, status: 'queued' };

Deno.test('loadBlueprintData (Blueprint, Family Map, free PDF, learner emails): matches and the coming-soon line follow her stored plan_year', async () => {
  route(pdfWorld(5, { ...FA, plan_year: 'next' }));
  const next = (await loadBlueprintData(DB, freeJob)).children[0];
  assertEquals(next.grade, 5, 'the PDF still prints her current grade');
  assertEquals(next.comingSoonBand, '6-8');
  assert(next.matches.some((m) => m.name === 'Middle Years Press') && !next.matches.some((m) => m.name === 'Early Years Press'));

  route(pdfWorld(5, FA));
  const skipped = (await loadBlueprintData(DB, freeJob)).children[0];
  assertEquals(skipped.comingSoonBand, null, 'a 5th grader this year: no grades 6-8 line in the PDF either');
  assert(skipped.matches.some((m) => m.name === 'Early Years Press') && !skipped.matches.some((m) => m.name === 'Middle Years Press'));

  // An 8th grader this year: the 6-8 line (the PDF used to print the 9-12 line, because both sets sat in the window).
  route(pdfWorld(8, { ...FA, plan_year: 'this' }));
  assertEquals((await loadBlueprintData(DB, freeJob)).children[0].comingSoonBand, '6-8');
  route(pdfWorld(8, { ...FA, plan_year: 'next' }));
  assertEquals((await loadBlueprintData(DB, freeJob)).children[0].comingSoonBand, '9-12');
});

Deno.test('Helpful extras use the same planning grade (a set grade follows the curricula\'s +/- 1 rule around it)', () => {
  const extra = (id: string, grade_min: number | null, grade_max: number | null) => ({
    id, name: id, grade_min, grade_max, domains_served: ['Maker'], faith_alignment: 'Secular / neutral', price_cents: 0, approved: true,
    coming_soon: false, eden_band: null, prep_load: null, multi_age: false, resource_type: 'App', screen_based: false, url: null, affiliate_url: null, is_affiliate: false,
  });
  const rows = [extra('Any grade', null, null), extra('Grades 6-8', 6, 8), extra('Grades K-3', 0, 3)];
  const names = (plan_year?: string) => pickHelpfulExtras({ grade: 4, scores: CHILD, top3: TOP3, prefs: { budget: 'unsure', filters: {}, ...(plan_year ? { plan_year } : {}) }, rows, limit: 10 }).map((x) => x.name);
  assertEquals(names(), ['Any grade', 'Grades K-3']);
  assertEquals(names('this'), ['Any grade', 'Grades K-3']);
  assertEquals(names('next'), ['Any grade', 'Grades 6-8']);
});
