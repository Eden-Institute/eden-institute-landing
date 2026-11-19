// supabase/functions/_shared/wired-match.ts
//
// Fearfully & Wonderfully Wired, ticket W2: curriculum matching. PURE (no I/O).
// Spec section 6 as amended by section 18 answer 25 (budget bounds, prep codes, ranking).
//
// 🛑 Affiliate status never affects ranking (spec rule 3). The ranking functions take a
// MatchCurriculum, a type with NO affiliate field; toMatchCurriculum() builds it from a
// database row and drops is_affiliate / affiliate_url / the founder-only dm_* fields
// before anything is scored. The tests flip every affiliate flag and compare rankings.

import { type Domain, type Scores, DOMAINS } from './wired-engine.ts';

export const MATCH_VERSION = 'wired-match-1';

export type Component = 'wiring' | 'budget' | 'prep' | 'siblings';
export const COMPONENTS: readonly Component[] = ['wiring', 'budget', 'prep', 'siblings'];

/** Skipped ranking = wiring > open-and-go > budget > several kids (DECIDED 11/17). */
export const DEFAULT_RANKING: readonly Component[] = ['wiring', 'prep', 'budget', 'siblings'];

/** Rank Order Centroid weights for 4 ranks (Barron & Barrett 1996): w_i = (1/n) * sum_{k=i..n} 1/k. */
export const ROC_WEIGHTS: readonly number[] = (() => {
  const n = 4;
  return Array.from({ length: n }, (_, i) => {
    let s = 0;
    for (let k = i + 1; k <= n; k++) s += 1 / k;
    return s / n;
  });
})();

/** Prep levels, lightest first; family `prep` codes map 1:1 (answer 25). */
export const PREP_LEVELS = ['open_and_go', 'light', 'moderate', 'heavy'] as const;

/** Budget codes are upper bounds in cents (answer 25). `unsure` = no budget scoring at all. */
export const BUDGET_BOUNDS_CENTS: Record<string, number> = {
  free: 0,
  under_100: 10_000,
  '100_300': 30_000,
  '300_600': 60_000,
  '600_1000': 100_000,
  over_1000: Number.POSITIVE_INFINITY,
};

/**
 * faith_alignment values that pass "Only show Christian curricula". PROPOSED, pending Lane NP:
 * the Lists tab has "Christian (explicit)", "Christian-friendly", "Secular / neutral",
 * "Other faith"; whether "Christian-friendly" passes is not decided yet.
 */
export const CHRISTIAN_FAITH_VALUES: readonly string[] = ['christian_explicit'];

/** "Open-and-go" -> "open_and_go", "Christian (explicit)" -> "christian_explicit". */
export function normalizeCode(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') : '';
}

/** What ranking may read. No affiliate field exists on this type, by design. */
export interface MatchCurriculum {
  id: string;
  name: string;
  grade_min: number | null;
  grade_max: number | null;
  domains_served: Domain[];
  prep_load: string;           // normalized code
  price_cents: number | null;
  multi_age: boolean;
  faith_alignment: string;     // normalized code
  approved: boolean;
  coming_soon: boolean;
  eden_band: string | null;
}

/** Project a wired_curricula row onto MatchCurriculum, dropping everything ranking must not see. */
// deno-lint-ignore no-explicit-any
export function toMatchCurriculum(row: Record<string, any>): MatchCurriculum {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    grade_min: Number.isInteger(row.grade_min) ? row.grade_min : null,
    grade_max: Number.isInteger(row.grade_max) ? row.grade_max : null,
    domains_served: (Array.isArray(row.domains_served) ? row.domains_served : [])
      .map(normalizeCode)
      .filter((d: string): d is Domain => (DOMAINS as readonly string[]).includes(d)),
    prep_load: normalizeCode(row.prep_load),
    price_cents: Number.isInteger(row.price_cents) ? row.price_cents : null,
    multi_age: row.multi_age === true,
    faith_alignment: normalizeCode(row.faith_alignment),
    approved: row.approved === true,
    coming_soon: row.coming_soon === true,
    eden_band: row.eden_band ? String(row.eden_band) : null,
  };
}

export interface EsaRow { curriculum_id: string; state: string; eligible: string; verified_at: string | null }

export interface MatchPrefs {
  kids: string;                       // '1' | '2' | '3' | '4' | '5plus'
  prep: string;                       // a PREP_LEVELS code
  budget: string;                     // a BUDGET_BOUNDS_CENTS code or 'unsure'
  ranking?: string[] | null;          // her tap order; null/invalid = DEFAULT_RANKING
  filters?: { withinBudget?: boolean; christianOnly?: boolean; esaOnly?: boolean; state?: string | null };
}

export interface MatchInput {
  grade: number;                      // the child's grade (K = 0)
  scores: Scores;                     // blended scores
  top3: Domain[];                     // blended top 3
  prefs: MatchPrefs;
  curricula: MatchCurriculum[];
  esa?: EsaRow[];
  limit?: number;                     // default 5 (free results + free PDF)
  christianValues?: readonly string[];
}

export interface Match {
  id: string;
  name: string;
  score: number;                                  // 0..1, rounded to 4 decimals
  components: Record<Component, number>;          // each 0..1
  contributions: Record<Component, number>;       // weight x component
  /**
   * The reason lines to show (answer 28c): the two largest contributions, largest first,
   * never 'siblings' for a one-child family and never 'budget' when she said "not sure"
   * (or the price is unknown); plus 'esa' as a third when the ESA box is ticked.
   */
  because: (Component | 'esa')[];
  served_top3: Domain[];                          // which of the child's top 3 it serves
  esa_state?: string;                             // set when 'esa' is a reason
}

export interface MatchOutput {
  matches: Match[];
  weights: Record<Component, number>;
  ranking: Component[];
  coming_soon: { name: string; eden_band: string | null }[];   // shown outside the ranked list
  budget_filter_offered: boolean;
  match_version: string;
}

/** A valid 4-item ranking, or the default. A one-child family's 3-item ranking gets siblings last (answer 25). */
export function resolveRanking(ranking: string[] | null | undefined): Component[] {
  if (!Array.isArray(ranking)) return DEFAULT_RANKING.slice();
  const r = ranking.map(normalizeCode) as Component[];
  const full = r.length === 3 && !r.includes('siblings') ? [...r, 'siblings' as Component] : r;
  const ok = full.length === 4 && new Set(full).size === 4 && full.every((c) => COMPONENTS.includes(c));
  return ok ? full : DEFAULT_RANKING.slice();
}

export function rankWeights(ranking: Component[]): Record<Component, number> {
  const w = {} as Record<Component, number>;
  ranking.forEach((c, i) => (w[c] = ROC_WEIGHTS[i]));
  return w;
}

/** Grade range includes the child's grade +/- 1 (DECIDED 11/17). */
export function gradeFits(c: Pick<MatchCurriculum, 'grade_min' | 'grade_max'>, grade: number): boolean {
  if (c.grade_min === null || c.grade_max === null) return false;
  return c.grade_min <= grade + 1 && c.grade_max >= grade - 1;
}

export function wiringComponent(c: MatchCurriculum, scores: Scores, top3: Domain[]): { value: number; served: Domain[] } {
  const total = top3.reduce((s, d) => s + scores[d], 0);
  const served = top3.filter((d) => c.domains_served.includes(d));
  if (total <= 0) return { value: 0, served };
  return { value: served.reduce((s, d) => s + scores[d], 0) / total, served };
}

/** 1 within budget, 0.5 up to 25% over, else 0. `unsure` scores 1 for everything. Unknown price = 0. */
export function budgetComponent(c: MatchCurriculum, budget: string): number {
  if (budget === 'unsure' || !(budget in BUDGET_BOUNDS_CENTS)) return 1;
  if (c.price_cents === null) return 0;
  const bound = BUDGET_BOUNDS_CENTS[budget];
  if (c.price_cents <= bound) return 1;
  if (c.price_cents <= bound * 1.25) return 0.5;
  return 0;
}

/** 1 if its prep load fits her daily prep time, 0.5 one step over, else 0 (unknown prep = 0). */
export function prepComponent(c: MatchCurriculum, prep: string): number {
  const her = PREP_LEVELS.indexOf(prep as typeof PREP_LEVELS[number]);
  const its = PREP_LEVELS.indexOf(c.prep_load as typeof PREP_LEVELS[number]);
  if (her < 0 || its < 0) return 0;
  if (its <= her) return 1;
  if (its === her + 1) return 0.5;
  return 0;
}

/** 1 for a one-child family; with 2+, 1 when it is multi-age, else 0.3. */
export function siblingsComponent(c: MatchCurriculum, kids: string): number {
  if (kids === '1') return 1;
  return c.multi_age ? 1 : 0.3;
}

/** "Only show ESA-eligible options": yes under ANY program in her state, with a verified date. */
export function esaEligible(curriculumId: string, state: string | null | undefined, esa: EsaRow[] = []): boolean {
  if (!state) return false;
  const st = state.toUpperCase();
  return esa.some((r) => r.curriculum_id === curriculumId && r.state.toUpperCase() === st && r.eligible === 'yes' && !!r.verified_at);
}

/** Rank the approved curricula for one child (spec section 6). */
export function rankCurricula(input: MatchInput): MatchOutput {
  const { grade, scores, top3, prefs } = input;
  const ranking = resolveRanking(prefs.ranking);
  const weights = rankWeights(ranking);
  const christian = (input.christianValues ?? CHRISTIAN_FAITH_VALUES).map(normalizeCode);
  const budgetOffered = prefs.budget !== 'unsure' && prefs.budget in BUDGET_BOUNDS_CENTS;
  const f = prefs.filters ?? {};

  const inGrade = input.curricula.filter((c) => c.approved && gradeFits(c, grade));
  const comingSoon = inGrade.filter((c) => c.coming_soon).map((c) => ({ name: c.name, eden_band: c.eden_band }));

  const candidates = inGrade.filter((c) => {
    if (c.coming_soon) return false;
    if (f.withinBudget && budgetOffered && budgetComponent(c, prefs.budget) !== 1) return false;
    if (f.christianOnly && !christian.includes(c.faith_alignment)) return false;
    if (f.esaOnly && !esaEligible(c.id, f.state ?? null, input.esa)) return false;
    return true;
  });

  const matches: Match[] = candidates.map((c) => {
    const wiring = wiringComponent(c, scores, top3);
    const components: Record<Component, number> = {
      wiring: wiring.value,
      budget: budgetComponent(c, prefs.budget),
      prep: prepComponent(c, prefs.prep),
      siblings: siblingsComponent(c, prefs.kids),
    };
    const contributions = {} as Record<Component, number>;
    let score = 0;
    for (const k of COMPONENTS) {
      contributions[k] = weights[k] * components[k];
      score += contributions[k];
    }
    // "Matched because": the two components with the largest weighted contribution;
    // ties follow her ranking order, so the reason she ranked higher is named first.
    // A one-child family never sees the siblings reason; "not sure" on budget (or an
    // unknown price) never shows a budget reason (answer 28c).
    const showable = (k: Component) =>
      contributions[k] > 0 &&
      !(k === 'siblings' && prefs.kids === '1') &&
      !(k === 'budget' && (!budgetOffered || c.price_cents === null));
    const because: Match['because'] = ranking.slice()
      .sort((a, b) => contributions[b] - contributions[a] || ranking.indexOf(a) - ranking.indexOf(b))
      .filter(showable).slice(0, 2);
    const m: Match = { id: c.id, name: c.name, score: Math.round(score * 1e4) / 1e4, components, contributions, because, served_top3: wiring.served };
    if (f.esaOnly && f.state) {
      m.because.push('esa');
      m.esa_state = f.state.toUpperCase();
    }
    return m;
  });

  // Ties: alphabetical by name (never by affiliate status), then id for a stable order.
  matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id));

  return {
    matches: matches.slice(0, input.limit ?? 5),
    weights,
    ranking,
    coming_soon: comingSoon,
    budget_filter_offered: budgetOffered,
    match_version: MATCH_VERSION,
  };
}
