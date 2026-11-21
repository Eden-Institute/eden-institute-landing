// supabase/functions/_shared/wired-display.ts
//
// Fearfully & Wonderfully Wired: what the results page shows next to the ranking. PURE (no I/O; the reads
// live in wired-submit-flow.ts). Used by wired-matches and wired-results (and the learner drain, em-6).
//
//   1. Match display fields (Lane 2, 2026-11-21): each ranked match gets its link (the affiliate link when
//      it is one, else the normal link), is_affiliate, price_cents + price_basis as stored, and the prep code.
//      Read ONLY AFTER rankCurricula has ordered the matches (spec rule 3), and never reorders them.
//   2. Helpful extras (spec answer 38): up to 3 non-curriculum resources below the ranked matches, chosen by
//      the child's top wirings + grade (blank grades on an extra = any grade) + her Christian / ESA / budget
//      filters. Same data as the Curriculum Finder's "Helpful extras" section (wired_curricula rows whose
//      resource_type is set and is not "Curriculum", web/lib/curriculumFinder.ts isHelpfulExtra) and the same
//      link rule as public.curriculum_finder_list(). Never ranked on the page (no position numbers), and
//      affiliate status never changes which extras show or their order.
//   3. The later $28 upgrade (spec 9.2; copy APPROVED 2026-11-21 ~8:52 AM CT): a live Blueprint bought this
//      quiz year, and no Family Map yet, is exactly create-checkout's gate for wired_family_map_upgrade.

import { type Domain, type Scores } from './wired-engine.ts';
import { WIRED_PRODUCTS } from './wired-checkout.ts';
import {
  BUDGET_BOUNDS_CENTS,
  budgetComponent,
  CHRISTIAN_FAITH_VALUES,
  type EsaRow,
  esaEligible,
  gradeFits,
  type Match,
  type MatchPrefs,
  normalizeCode,
  toMatchCurriculum,
  wiringComponent,
} from './wired-match.ts';

// ── 1. Match display fields ─────────────────────────────────────────────────

/** The wired_curricula columns a match's display reads (after ranking). */
export const DISPLAY_COLUMNS = 'id,url,affiliate_url,is_affiliate,price_cents,price_basis,prep_load';

export interface DisplayRow {
  id: string;
  url: string | null;
  affiliate_url: string | null;
  is_affiliate: boolean | null;
  price_cents: number | null;
  price_basis: string | null;
  prep_load: string | null;
}

export interface MatchDisplay {
  url: string | null;          // the affiliate link when is_affiliate, else the normal link
  is_affiliate: boolean;
  price_cents: number | null;  // as stored
  price_basis: string | null;  // as stored
  prep_load: string;           // the prep code ('open_and_go' ...), '' when not recorded
}

export type DisplayedMatch = Match & MatchDisplay;

const blank = (s: unknown): string | null => (typeof s === 'string' && s.trim() ? s.trim() : null);

/** Same rule as public.curriculum_finder_list(): an affiliate link only when it is flagged AND present. */
export function displayLink(row: { url?: unknown; affiliate_url?: unknown; is_affiliate?: unknown }): { url: string | null; is_affiliate: boolean } {
  const aff = blank(row.affiliate_url);
  const isAffiliate = row.is_affiliate === true && aff !== null;
  return { url: isAffiliate ? aff : blank(row.url), is_affiliate: isAffiliate };
}

/** Adds the display fields to already-ranked matches. Order and every ranking field stay exactly as given. */
export function withDisplay(matches: Match[], rows: DisplayRow[]): DisplayedMatch[] {
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  return matches.map((m) => {
    const r = byId.get(m.id);
    return {
      ...m,
      ...displayLink(r ?? {}),
      price_cents: r && Number.isInteger(r.price_cents) ? r.price_cents : null,
      price_basis: blank(r?.price_basis),
      prep_load: normalizeCode(r?.prep_load),
    };
  });
}

// ── 2. Helpful extras ───────────────────────────────────────────────────────

/** Up to 3 extras (spec answer 38). */
export const EXTRAS_LIMIT = 3;

/** The wired_curricula columns the extras read: the ranking-safe ones, plus type, screen and the link (read after choosing). */
export const EXTRAS_COLUMNS =
  'id,name,grade_min,grade_max,domains_served,faith_alignment,price_cents,approved,coming_soon,eden_band,prep_load,multi_age,resource_type,screen_based,url,affiliate_url,is_affiliate';

/** "Curriculum" (or no type, a row from before the column) is a curriculum; anything else is a Helpful extra. */
export function isHelpfulExtra(row: { resource_type?: unknown }): boolean {
  const t = blank(row.resource_type);
  return t !== null && t !== 'Curriculum';
}

export interface HelpfulExtra {
  id: string;
  name: string;
  resource_type: string;     // its type label as stored (App, Video library, Songs...)
  screen_based: boolean;     // true only when the row says Yes
  url: string | null;
  is_affiliate: boolean;
}

export interface ExtrasInput {
  grade: number;
  scores: Scores;
  top3: Domain[];
  prefs: Pick<MatchPrefs, 'budget' | 'filters'>;
  // deno-lint-ignore no-explicit-any
  rows: Record<string, any>[];
  esa?: EsaRow[];
  limit?: number;
  christianValues?: readonly string[];
}

/**
 * The Helpful extras for one child. Choosing reads only the ranking-safe projection (toMatchCurriculum drops
 * is_affiliate / affiliate_url); the link is looked up after the choice is made. Order: how much of the
 * child's top-3 score the extra serves, then name, then id (never affiliate status).
 */
export function pickHelpfulExtras(input: ExtrasInput): HelpfulExtra[] {
  const { grade, scores, top3, prefs } = input;
  const f = prefs.filters ?? {};
  const christian = (input.christianValues ?? CHRISTIAN_FAITH_VALUES).map(normalizeCode);
  const budgetOffered = prefs.budget !== 'unsure' && prefs.budget in BUDGET_BOUNDS_CENTS;
  const raw = new Map(input.rows.map((r) => [String(r.id), r]));

  const chosen = input.rows
    .filter((r) => isHelpfulExtra(r))
    .map((r) => ({ c: toMatchCurriculum(r), type: blank(r.resource_type)!, screen: r.screen_based === true }))
    .filter(({ c }) => c.approved && !c.coming_soon)
    // Blank grades on an extra = any grade (answer 38); a set grade follows the curricula's +/- 1 rule.
    .filter(({ c }) => gradeFits({ grade_min: c.grade_min ?? 0, grade_max: c.grade_max ?? 12 }, grade))
    .map((x) => ({ ...x, wiring: wiringComponent(x.c, scores, top3) }))
    .filter(({ wiring }) => wiring.served.length > 0)
    .filter(({ c }) => !(f.christianOnly && !christian.includes(c.faith_alignment)))
    .filter(({ c }) => !(f.esaOnly && !esaEligible(c.id, f.state ?? null, input.esa)))
    .filter(({ c }) => !(f.withinBudget && budgetOffered && budgetComponent(c, prefs.budget) !== 1))
    .sort((a, b) => b.wiring.value - a.wiring.value || a.c.name.localeCompare(b.c.name, 'en', { sensitivity: 'base' }) || a.c.id.localeCompare(b.c.id))
    .slice(0, input.limit ?? EXTRAS_LIMIT);

  return chosen.map(({ c, type, screen }) => ({ id: c.id, name: c.name, resource_type: type, screen_based: screen, ...displayLink(raw.get(c.id) ?? {}) }));
}

// ── 3. The later $28 upgrade ────────────────────────────────────────────────

/** Every product that is (or includes) the Family Map: create-checkout's FAMILY_MAP_PRODUCTS. */
export const FAMILY_MAP_PRODUCTS: readonly string[] = WIRED_PRODUCTS.filter((p) => p !== 'blueprint');

export interface BuyerRow { product: string; order_id: string | null; refunded_at: string | null; disputed_at: string | null; purchased_at?: string | null }
export interface UnlockRow { order_id: string | null; child_id: string | null }

/**
 * The $28 upgrade offer for a family, from its wired_buyers rows for THIS quiz year (create-checkout's gate):
 * a Blueprint that is not refunded or disputed, and no live Family Map. Names the child whose Blueprint it is
 * (the earliest one), for "You already have [Nickname]'s Blueprint..."; null when the offer does not apply or
 * no Blueprint child can be named.
 */
export function familyMapUpgrade(buys: BuyerRow[], unlocks: UnlockRow[], nicknames: Map<string, string>): { blueprint_nickname: string } | null {
  const live = buys.filter((b) => !b.refunded_at && !b.disputed_at);
  if (live.some((b) => FAMILY_MAP_PRODUCTS.includes(b.product))) return null;
  const blueprints = live.filter((b) => b.product === 'blueprint' && b.order_id)
    .sort((a, b) => String(a.purchased_at ?? '').localeCompare(String(b.purchased_at ?? '')));
  for (const b of blueprints) {
    for (const u of unlocks) {
      if (u.order_id !== b.order_id || !u.child_id) continue;
      const nick = nicknames.get(u.child_id);
      if (nick) return { blueprint_nickname: nick };
    }
  }
  return null;
}
