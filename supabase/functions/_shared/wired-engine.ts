// supabase/functions/_shared/wired-engine.ts
//
// Fearfully & Wonderfully Wired (learner quiz), ticket W2: banks + scoring. PURE: no I/O,
// no Deno or browser APIs, so wired-submit, the replay cron and the tests all share it.
//
// Spec: Eden's Table (Homeschool Curriculum)/Projects/New Projects Lane/
//       Wired_Quiz_Phase1_Developer_Spec.md, section 5, as amended by section 18
//       (answers 8, 19, 23, 24). Banks: _shared/wired-banks/<version>.json, converted
//       verbatim from Camila's approved question sets (k2-v1, g35-v1 2026-11-18;
//       g68-v1, g912-v1, teen-v1, adult-v1 2026-11-19).
//
// The engine scores strengths "right now". It never labels a child, never diagnoses,
// and the copy layer (W4/W7) words every result that way (spec rule 1).

export const ENGINE_VERSION = 'wired-engine-1';

/** The 9 wirings, in the fixed order used for the last tie-break (spec section 5). */
export const DOMAINS = [
  'storyteller', 'organizer', 'designer', 'maker', 'psalmist',
  'connector', 'ponderer', 'cultivator', 'seeker',
] as const;
export type Domain = typeof DOMAINS[number];
export type Scores = Record<Domain, number>;

export type SetKind = 'k2' | 'g3_5' | 'g6_8' | 'g9_12' | 'teen' | 'adult';

export interface BankOption { id: string; domain: Domain; text: string }
export interface BankScenario { id: string; prompt: string; options: BankOption[] }
export interface BankFrequencyItem { id: string; domain: Domain; text: string }
export interface TeachingItem { id: string; stem: string; left: string; right: string }
export interface TeachingDimension { key: string; left: string; right: string; items: TeachingItem[] }

export interface Bank {
  version: string;
  set_kind: SetKind;
  approved_at?: string;
  source?: string;
  intro?: string;
  instructions: string;
  frequency_stem: string;
  scale: { points: number; labels: string[] };
  weights: { scenario: number; frequency: number };
  scenarios: BankScenario[];
  frequency: BankFrequencyItem[];
  teaching_style?: {
    instructions: string;
    scale: { points: number; labels: string[] };
    bands: { left_max: number; right_min: number };
    dimensions: TeachingDimension[];
  };
}

const isDomain = (d: unknown): d is Domain => typeof d === 'string' && (DOMAINS as readonly string[]).includes(d);

// ── Bank validation ──────────────────────────────────────────────────────────

/**
 * Every problem that would make a bank unsafe to activate. Empty = valid.
 * The rule that matters most (spec section 5): every wiring appears EQUALLY often
 * across the scenarios, because unequal exposure biases forced-choice totals.
 * The approved banks are the 12 lines of a 3x3 grid: each wiring 4 times, and every
 * pair of wirings shares exactly one scenario (checked too, as a warning-level error).
 */
export function validateBank(bank: Bank): string[] {
  const errs: string[] = [];
  if (!bank || typeof bank !== 'object') return ['bank is not an object'];
  if (!bank.version) errs.push('missing version');
  if (!['k2', 'g3_5', 'g6_8', 'g9_12', 'teen', 'adult'].includes(bank.set_kind)) errs.push(`bad set_kind ${bank.set_kind}`);
  const points = bank.scale?.points;
  if (!Number.isInteger(points) || points < 2) errs.push('scale.points must be an integer >= 2');
  if (bank.scale?.labels?.length !== points) errs.push('scale.labels must name every point');
  const w = bank.weights;
  if (!w || !(w.scenario >= 0) || !(w.frequency >= 0) || Math.abs(w.scenario + w.frequency - 1) > 1e-9) {
    errs.push('weights.scenario + weights.frequency must be 1');
  }

  const ids = new Set<string>();
  const seen = (id: string) => {
    if (!id) errs.push('an item has no id');
    else if (ids.has(id)) errs.push(`duplicate id ${id}`);
    else ids.add(id);
  };

  const exposure = Object.fromEntries(DOMAINS.map((d) => [d, 0])) as Scores;
  const pairs = new Map<string, number>();
  if (!Array.isArray(bank.scenarios) || bank.scenarios.length === 0) errs.push('no scenarios');
  for (const s of bank.scenarios ?? []) {
    seen(s.id);
    if (!Array.isArray(s.options) || s.options.length < 2) {
      errs.push(`${s.id}: needs at least 2 options`);
      continue;
    }
    const inScenario = new Set<string>();
    for (const o of s.options) {
      seen(o.id);
      if (!isDomain(o.domain)) errs.push(`${o.id}: unknown domain ${o.domain}`);
      else if (inScenario.has(o.domain)) errs.push(`${s.id}: domain ${o.domain} twice`);
      else {
        inScenario.add(o.domain);
        exposure[o.domain]++;
      }
      if (!o.text) errs.push(`${o.id}: no text`);
    }
    const ds = [...inScenario].sort();
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        const k = `${ds[i]}|${ds[j]}`;
        pairs.set(k, (pairs.get(k) ?? 0) + 1);
      }
    }
  }
  const counts = DOMAINS.map((d) => exposure[d]);
  if (counts.some((c) => c === 0)) errs.push(`a wiring never appears in a scenario: ${DOMAINS.filter((d) => !exposure[d]).join(', ')}`);
  if (new Set(counts).size > 1) {
    errs.push(`unequal exposure across scenarios: ${DOMAINS.map((d) => `${d}=${exposure[d]}`).join(' ')}`);
  }
  // Balanced design (every pair once) holds for the 3x3-grid banks; flag drift.
  if (bank.scenarios?.length === 12 && bank.scenarios.every((s) => s.options?.length === 3)) {
    const bad = [...pairs.entries()].filter(([, n]) => n !== 1);
    if (pairs.size !== 36 || bad.length) errs.push('not a balanced 3x3-grid design (every pair of wirings once)');
  }

  if (!Array.isArray(bank.frequency) || bank.frequency.length !== DOMAINS.length) {
    errs.push(`frequency items: need exactly one per wiring (${DOMAINS.length})`);
  } else {
    const fd = new Set(bank.frequency.map((f) => f.domain));
    for (const f of bank.frequency) {
      seen(f.id);
      if (!isDomain(f.domain)) errs.push(`${f.id}: unknown domain ${f.domain}`);
    }
    if (fd.size !== DOMAINS.length) errs.push('frequency items: each wiring exactly once');
  }

  if (bank.set_kind === 'adult') {
    const ts = bank.teaching_style;
    if (!ts) errs.push('adult bank needs teaching_style');
    else {
      if (ts.scale?.points !== 5 || ts.scale?.labels?.length !== 5) errs.push('teaching_style: 5 fully labelled points (answer 24)');
      if (!(ts.bands?.left_max < ts.bands?.right_min)) errs.push('teaching_style: bands.left_max must be below bands.right_min');
      if (ts.dimensions?.length !== 4) errs.push('teaching_style: 4 dimensions');
      for (const d of ts.dimensions ?? []) {
        if (!d.key || !d.left || !d.right) errs.push(`teaching_style ${d.key}: needs key, left, right`);
        if (d.items?.length !== 3) errs.push(`teaching_style ${d.key}: 3 items`);
        for (const it of d.items ?? []) {
          seen(it.id);
          if (!it.stem || !it.left || !it.right) errs.push(`${it.id}: needs stem, left, right`);
        }
      }
    }
  } else if (bank.teaching_style) {
    errs.push('teaching_style belongs to the adult bank only');
  }
  return errs;
}

// ── What the browser may see (wired-bank) ────────────────────────────────────

export interface PublicBank {
  version: string;
  set_kind: SetKind;
  intro?: string;
  instructions: string;
  frequency_stem: string;
  scale: { points: number; labels: string[] };
  scenarios: { id: string; prompt: string; options: { id: string; text: string }[] }[];
  frequency: { id: string; text: string }[];
  teaching_style?: {
    instructions: string;
    scale: { points: number; labels: string[] };
    items: { id: string; stem: string; left: string; right: string }[];
  };
}

/**
 * The bank with every scoring key stripped (no domain on any option or item, no
 * weights, no teaching-style dimension keys), options shuffled per call so the
 * grid order is not the screen order. `random` is injectable for tests.
 */
export function publicBank(bank: Bank, random: () => number = Math.random): PublicBank {
  const shuffle = <T>(xs: T[]): T[] => {
    const a = xs.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const out: PublicBank = {
    version: bank.version,
    set_kind: bank.set_kind,
    instructions: bank.instructions,
    frequency_stem: bank.frequency_stem,
    scale: { points: bank.scale.points, labels: bank.scale.labels.slice() },
    scenarios: bank.scenarios.map((s) => ({
      id: s.id,
      prompt: s.prompt,
      options: shuffle(s.options).map((o) => ({ id: o.id, text: o.text })),
    })),
    frequency: bank.frequency.map((f) => ({ id: f.id, text: f.text })),
  };
  if (bank.intro) out.intro = bank.intro;
  if (bank.teaching_style) {
    out.teaching_style = {
      instructions: bank.teaching_style.instructions,
      scale: { points: bank.teaching_style.scale.points, labels: bank.teaching_style.scale.labels.slice() },
      items: bank.teaching_style.dimensions.flatMap((d) => d.items.map((i) => ({ id: i.id, stem: i.stem, left: i.left, right: i.right }))),
    };
  }
  return out;
}

// ── Scoring one rater ────────────────────────────────────────────────────────

/** Raw answers as stored in wired_sessions.raw_answers. */
export interface RaterAnswers {
  scenarios: Record<string, string>;   // scenario id -> chosen option id
  frequency: Record<string, number>;   // frequency item id -> 1..points
  teaching?: Record<string, number>;   // adult only: teaching item id -> 1..5
}

export interface RaterResult {
  scores: Scores;          // 0-100 per wiring
  frequency: Scores;       // the frequency component alone, 0-1 (tie-break + blend)
  top3: Domain[];
  renaissance: boolean;
  engine_version: string;
  bank_version: string;
}

export class AnswerError extends Error {}

/**
 * Score one rater against one bank (spec section 5, PROPOSED defaults approved with the spec):
 *   scen_d  = picks_d / appearances_d          (0..1)
 *   freq_d  = (rating - 1) / (points - 1)       (0..1)
 *   score_d = round(100 * (w_s * scen_d + w_f * freq_d))
 * Every scenario and every frequency item must be answered with a valid choice; anything
 * else throws AnswerError (wired-submit turns it into a 400; nothing is stored).
 */
export function scoreRater(bank: Bank, answers: RaterAnswers): RaterResult {
  const errs = validateBank(bank);
  if (errs.length) throw new Error(`bank ${bank?.version} is invalid: ${errs[0]}`);
  if (!answers || typeof answers !== 'object') throw new AnswerError('no answers');
  const sc = answers.scenarios ?? {};
  const fq = answers.frequency ?? {};
  const known = new Set(bank.scenarios.map((s) => s.id));
  for (const k of Object.keys(sc)) if (!known.has(k)) throw new AnswerError(`unknown scenario ${k}`);
  const knownF = new Set(bank.frequency.map((f) => f.id));
  for (const k of Object.keys(fq)) if (!knownF.has(k)) throw new AnswerError(`unknown frequency item ${k}`);

  const picks = zero();
  const appearances = zero();
  for (const s of bank.scenarios) {
    for (const o of s.options) appearances[o.domain]++;
    const chosen = sc[s.id];
    const opt = s.options.find((o) => o.id === chosen);
    if (!opt) throw new AnswerError(`scenario ${s.id}: no valid choice`);
    picks[opt.domain]++;
  }
  const points = bank.scale.points;
  const freq = zero();
  for (const f of bank.frequency) {
    const r = fq[f.id];
    if (!Number.isInteger(r) || r < 1 || r > points) throw new AnswerError(`frequency ${f.id}: rating must be 1..${points}`);
    freq[f.domain] = (r - 1) / (points - 1);
  }
  const { scenario: ws, frequency: wf } = bank.weights;
  const scores = zero();
  for (const d of DOMAINS) {
    const scen = appearances[d] ? picks[d] / appearances[d] : 0;
    scores[d] = Math.round(100 * (ws * scen + wf * freq[d]));
  }
  const top3 = rankDomains(scores, freq).slice(0, 3);
  return {
    scores,
    frequency: freq,
    top3,
    renaissance: isRenaissance(scores),
    engine_version: ENGINE_VERSION,
    bank_version: bank.version,
  };
}

/** Domains highest first; ties by the frequency component, then by DOMAINS order (spec section 5). */
export function rankDomains(scores: Scores, freq: Scores): Domain[] {
  return DOMAINS.slice().sort((a, b) =>
    scores[b] - scores[a] || freq[b] - freq[a] || DOMAINS.indexOf(a) - DOMAINS.indexOf(b)
  );
}

/** Renaissance profile: the top five wirings within 10 points of each other (DECIDED 11/17). */
export function isRenaissance(scores: Scores): boolean {
  const s = DOMAINS.map((d) => scores[d]).sort((a, b) => b - a);
  return s[0] - s[4] <= 10;
}

// ── Blend (mom 50%, everyone else shares 50%) ────────────────────────────────

export interface BlendInput {
  role: 'mom' | 'teen' | 'observer';
  session_id: string;
  result: Pick<RaterResult, 'scores' | 'frequency'>;
}

export interface BlendResult {
  blended_scores: Scores;   // rounded to 1 decimal
  frequency: Scores;
  top3: Domain[];
  renaissance: boolean;
  weights: Record<string, number>;   // session_id -> weight actually used
  session_ids: string[];
  engine_version: string;
}

/**
 * blend_d = 0.5 * mom_d + 0.5 * mean(other raters_d); with mom alone, blend = mom
 * (DECIDED 11/17 + 2026-11-18 "Exactly 50%"). Mom + teen + 2 observers = 50 / 16.7 / 16.7 / 16.7.
 * Without a mom session (should not happen: mom always rates first) every rater weighs the same.
 */
export function blend(raters: BlendInput[]): BlendResult {
  if (!raters.length) throw new Error('blend needs at least one rater');
  const moms = raters.filter((r) => r.role === 'mom');
  if (moms.length > 1) throw new Error('blend: at most one mom session per child per year');
  const others = raters.filter((r) => r.role !== 'mom');
  const weights: Record<string, number> = {};
  if (moms.length === 1) {
    weights[moms[0].session_id] = others.length ? 0.5 : 1;
    for (const o of others) weights[o.session_id] = 0.5 / others.length;
  } else {
    for (const o of others) weights[o.session_id] = 1 / others.length;
  }
  const scores = zero();
  const freq = zero();
  for (const r of raters) {
    const w = weights[r.session_id];
    for (const d of DOMAINS) {
      scores[d] += w * r.result.scores[d];
      freq[d] += w * r.result.frequency[d];
    }
  }
  for (const d of DOMAINS) scores[d] = Math.round(scores[d] * 10) / 10;
  return {
    blended_scores: scores,
    frequency: freq,
    top3: rankDomains(scores, freq).slice(0, 3),
    renaissance: isRenaissance(scores),
    weights,
    session_ids: raters.map((r) => r.session_id),
    engine_version: ENGINE_VERSION,
  };
}

// ── Teaching style (mom's Part B, answer 24) ─────────────────────────────────

export interface TeachingResult {
  key: string;
  score: number;                      // 0-100, 100 = fully the right end. NEVER shown.
  band: 'left' | 'balance' | 'right';
  label: string;                      // the bank's end label, or "a balance of both"
}

export const BALANCE_LABEL = 'a balance of both';

export function scoreTeachingStyle(bank: Bank, teaching: Record<string, number>): TeachingResult[] {
  const ts = bank.teaching_style;
  if (!ts) throw new Error(`bank ${bank.version} has no teaching style`);
  return ts.dimensions.map((d) => {
    const vals = d.items.map((it) => {
      const v = teaching?.[it.id];
      if (!Number.isInteger(v) || v < 1 || v > ts.scale.points) throw new AnswerError(`teaching ${it.id}: rating must be 1..${ts.scale.points}`);
      return v;
    });
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const score = Math.round(((mean - 1) / (ts.scale.points - 1)) * 100);
    const band = score <= ts.bands.left_max ? 'left' : score >= ts.bands.right_min ? 'right' : 'balance';
    return { key: d.key, score, band, label: band === 'left' ? d.left : band === 'right' ? d.right : BALANCE_LABEL };
  });
}

// ── Grade, band and quiz year ────────────────────────────────────────────────

/** Child set from grade (K = 0): switches at grades 3, 6 and 9 (DECIDED 11/17). */
export function setKindForGrade(grade: number): Exclude<SetKind, 'teen' | 'adult'> {
  if (!Number.isInteger(grade) || grade < 0 || grade > 12) throw new RangeError(`grade must be 0..12, got ${grade}`);
  return grade <= 2 ? 'k2' : grade <= 5 ? 'g3_5' : grade <= 8 ? 'g6_8' : 'g9_12';
}

/**
 * The school year a date belongs to, stored as its start year: July 1 2026 to June 30
 * 2027 = 2026. The boundary is July 1 in America/Chicago (answer 8).
 */
export function quizYear(at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric' })
    .formatToParts(at);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  return m >= 7 ? y : y - 1;
}

function zero(): Scores {
  return Object.fromEntries(DOMAINS.map((d) => [d, 0])) as Scores;
}
