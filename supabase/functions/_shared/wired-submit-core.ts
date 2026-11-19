// supabase/functions/_shared/wired-submit-core.ts
//
// Fearfully & Wonderfully Wired, W3: the pure half of a quiz submission and of the results
// a page receives. No I/O. Spec sections 3, 4, 7.1, 7.2, 8 + section 18 answers 9, 14, 25, 28.
// The copy itself lives in the approved files and the W4 page; this returns DATA only.

import { cleanContactEmail } from './contact-email.ts';
import { type Domain, DOMAINS, type RaterAnswers, type Scores, setKindForGrade, type SetKind } from './wired-engine.ts';
import type { Match, MatchPrefs } from './wired-match.ts';

// ── Family answers (answer 25: value codes from Wired_Quiz_Family_Questions.md) ──
export const FAMILY_CODES = {
  kids: ['1', '2', '3', '4', '5plus'],
  prep: ['open_and_go', 'light', 'moderate', 'heavy'],
  frustration: ['time', 'engagement', 'multi_age', 'enough', 'budget', 'choosing', 'other'],
  approach: ['classical', 'charlotte_mason', 'traditional', 'unit_study', 'literature', 'montessori', 'waldorf', 'interest_led', 'online', 'eclectic', 'starting', 'unsure'],
  budget: ['free', 'under_100', '100_300', '300_600', '600_1000', 'over_1000', 'unsure'],
  esa: ['yes', 'planning', 'no', 'unsure'],
} as const;
export type FamilyAnswers = { [K in keyof typeof FAMILY_CODES]: typeof FAMILY_CODES[K][number] };

const RANKING_CODES = ['wiring', 'budget', 'prep', 'siblings'];
const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'placement', 'landing_path'] as const;

export interface Submission {
  email: string;              // lower-cased, Stripe-safe
  first_name: string | null;
  child: { nickname: string; grade: number } | null;   // null = mom's own (adult) set
  child_id: string | null;    // when the island already knows the child (retest, results page)
  set_kind: SetKind;
  bank_version: string;
  answers: RaterAnswers;
  family_answers: FamilyAnswers | null;   // the mom child quiz only
  ranking: string[] | null;
  attribution: Record<string, string>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// deno-lint-ignore no-control-regex
const CONTROL = /[\u0000-\u001f\u007f​-‍⁠﻿]/g;

/** A child's nickname: trimmed, invisible and control characters removed, 1-40 characters. */
export function cleanNickname(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(CONTROL, '').replace(/\s+/g, ' ').trim();
  return s.length >= 1 && s.length <= 40 ? s : null;
}

/** utm_* + placement + landing path only, each capped; the landing path loses its query and hash. Never child data (rule 7). */
export function cleanAttribution(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object') return out;
  const o = v as Record<string, unknown>;
  for (const k of ATTRIBUTION_KEYS) {
    const raw = o[k];
    if (typeof raw !== 'string') continue;
    let s = raw.replace(CONTROL, '').trim();
    if (k === 'landing_path') s = s.split('?')[0].split('#')[0];
    s = s.slice(0, k === 'landing_path' ? 200 : 100);
    if (s) out[k] = s;
  }
  return out;
}

function cleanAnswers(v: unknown): RaterAnswers | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const sc = o.scenarios;
  const fq = o.frequency;
  if (!sc || typeof sc !== 'object' || !fq || typeof fq !== 'object') return null;
  const scenarios: Record<string, string> = {};
  for (const [k, val] of Object.entries(sc as Record<string, unknown>)) {
    if (typeof val !== 'string' || k.length > 40 || val.length > 40) return null;
    scenarios[k] = val;
  }
  const frequency: Record<string, number> = {};
  for (const [k, val] of Object.entries(fq as Record<string, unknown>)) {
    if (typeof val !== 'number' || k.length > 40) return null;
    frequency[k] = val;
  }
  const out: RaterAnswers = { scenarios, frequency };
  if (o.teaching && typeof o.teaching === 'object') {
    const teaching: Record<string, number> = {};
    for (const [k, val] of Object.entries(o.teaching as Record<string, unknown>)) {
      if (typeof val !== 'number' || k.length > 40) return null;
      teaching[k] = val;
    }
    out.teaching = teaching;
  }
  if (Object.keys(scenarios).length > 50 || Object.keys(frequency).length > 50) return null;
  return out;
}

function cleanFamilyAnswers(v: unknown): FamilyAnswers | null | 'invalid' {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object') return 'invalid';
  const o = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, codes] of Object.entries(FAMILY_CODES)) {
    const val = o[k];
    if (typeof val !== 'string' || !(codes as readonly string[]).includes(val)) return 'invalid';
    out[k] = val;
  }
  return out as FamilyAnswers;
}

/** A tap-in-order ranking of known codes, no repeats; anything else = null (the default order applies). */
export function cleanRanking(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const r = v.filter((x) => typeof x === 'string' && RANKING_CODES.includes(x));
  return r.length === v.length && new Set(r).size === r.length && (r.length === 4 || r.length === 3) ? r : null;
}

/**
 * Parse and check a raw wired-submit body. Returns the clean submission or the list of
 * problems (400). Never trusts the browser's set_kind: it is derived from the grade (or
 * "adult" for mom's own set) and must match the bank version's set (checked against the
 * bank by the caller).
 */
export function parseSubmission(body: unknown): { ok: true; value: Submission } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') return { ok: false, errors: ['body must be a JSON object'] };
  const b = body as Record<string, unknown>;

  const email = cleanContactEmail(typeof b.email === 'string' ? b.email : null);
  if (!email) errors.push('a usable email is required');
  let first: string | null = null;
  if (typeof b.first_name === 'string' && b.first_name.trim()) {
    first = b.first_name.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;
  }

  const adult = b.set === 'adult';
  let child: Submission['child'] = null;
  let set_kind: SetKind = 'adult';
  const child_id = typeof b.child_id === 'string' && UUID_RE.test(b.child_id) ? b.child_id : null;
  if (!adult) {
    const nickname = cleanNickname((b.child as Record<string, unknown> | undefined)?.nickname);
    const grade = (b.child as Record<string, unknown> | undefined)?.grade;
    if (!nickname) errors.push('child.nickname: 1-40 characters');
    if (!Number.isInteger(grade) || (grade as number) < 0 || (grade as number) > 12) errors.push('child.grade: 0-12 (K = 0)');
    if (nickname && Number.isInteger(grade) && (grade as number) >= 0 && (grade as number) <= 12) {
      child = { nickname, grade: grade as number };
      set_kind = setKindForGrade(grade as number);
    }
  }

  const bank_version = typeof b.bank_version === 'string' && /^[a-z0-9]+-v\d+$/.test(b.bank_version) ? b.bank_version : null;
  if (!bank_version) errors.push('bank_version is required');
  const answers = cleanAnswers(b.answers);
  if (!answers) errors.push('answers: scenarios and frequency objects are required');

  const fa = cleanFamilyAnswers(b.family_answers);
  if (fa === 'invalid') errors.push('family_answers: every question needs one of its codes');
  if (!adult && fa === null) errors.push('family_answers are required with a child quiz');

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      email: email!.toLowerCase(),
      first_name: first,
      child,
      child_id,
      set_kind,
      bank_version: bank_version!,
      answers: answers!,
      family_answers: fa === 'invalid' ? null : fa,
      ranking: cleanRanking(b.ranking),
      attribution: cleanAttribution(b.attribution),
    },
  };
}

// ── Prefs for matching from her answers ──
export function prefsFromAnswers(fa: FamilyAnswers, ranking: string[] | null, filters: MatchPrefs['filters'] = {}): MatchPrefs {
  return { kids: fa.kids, prep: fa.prep, budget: fa.budget, ranking, filters };
}

// ── Best-fit approach (answer 28a; results copy section 2) ──
export const APPROACH_WIRINGS: Record<string, Domain[]> = {
  charlotte_mason: ['storyteller', 'cultivator', 'psalmist', 'ponderer', 'designer'],
  classical: ['organizer', 'storyteller', 'seeker'],
  traditional: ['organizer', 'ponderer'],
  unit_study: ['connector', 'maker', 'designer'],
  literature: ['storyteller', 'seeker', 'ponderer'],
  montessori: ['maker', 'designer', 'organizer', 'ponderer'],
  waldorf: ['psalmist', 'designer', 'maker', 'cultivator'],
};
export const SECOND_APPROACH_WITHIN = 5;

export interface ApproachFit {
  approach: string;          // an approach code
  mean: number | null;       // null for eclectic (Renaissance)
  room_for: Domain[];        // the child's two strongest wirings this approach gives room to
}
export interface ApproachResult {
  fits: ApproachFit[];       // 1 or 2
  her_approach: string | null;
  already_there: boolean;
}

/**
 * The mapped approach with the highest MEAN blended score over its wirings (an average, so
 * a long list cannot win by size); a second one when within 5 points; a Renaissance profile
 * shows "eclectic". Interest-led and online are never matched. Ties keep the order above.
 */
export function bestFitApproach(scores: Scores, renaissance: boolean, herApproach: string | null): ApproachResult {
  const her = herApproach ?? null;
  if (renaissance) {
    return { fits: [{ approach: 'eclectic', mean: null, room_for: topOf(DOMAINS.slice(), scores, 2) }], her_approach: her, already_there: her === 'eclectic' };
  }
  const ranked = Object.entries(APPROACH_WIRINGS)
    .map(([approach, ws], i) => ({ approach, i, mean: ws.reduce((s, d) => s + scores[d], 0) / ws.length, ws }))
    .sort((a, b) => b.mean - a.mean || a.i - b.i);
  const fits: ApproachFit[] = [{ approach: ranked[0].approach, mean: round1(ranked[0].mean), room_for: topOf(ranked[0].ws, scores, 2) }];
  if (ranked[1] && ranked[0].mean - ranked[1].mean <= SECOND_APPROACH_WITHIN) {
    fits.push({ approach: ranked[1].approach, mean: round1(ranked[1].mean), room_for: topOf(ranked[1].ws, scores, 2) });
  }
  return { fits, her_approach: her, already_there: !!her && fits.some((f) => f.approach === her) };
}

function topOf(ws: Domain[], scores: Scores, n: number): Domain[] {
  return ws.slice().sort((a, b) => scores[b] - scores[a] || DOMAINS.indexOf(a) - DOMAINS.indexOf(b)).slice(0, n);
}
const round1 = (n: number) => Math.round(n * 10) / 10;

// ── Tips (answer 28b) ──
export type TipKind = 'try_today' | 'low_prep' | 'together';
export function tipFirst(frustration: string | null | undefined): TipKind {
  if (frustration === 'time' || frustration === 'budget') return 'low_prep';
  if (frustration === 'multi_age' || frustration === 'choosing') return 'together';
  return 'try_today';
}

// ── The results a page receives ──
export interface ResultsPayload {
  child_id: string;
  nickname: string;
  grade: number;
  set_kind: SetKind;
  quiz_year: number;
  unlocked: boolean;
  /** Locked 3rd child (7.2): only the top wiring's name, nothing else. */
  preview?: { top_wiring: Domain };
  scores?: Scores;
  top3?: Domain[];
  renaissance?: boolean;
  approach?: ApproachResult;
  tip_first?: TipKind;
  top_wiring?: Domain;
  matches?: Match[];
  coming_soon?: { name: string; eden_band: string | null }[];
  offers: { blueprint: boolean; family_map: boolean };
}

export function buildResultsPayload(input: {
  child: { id: string; nickname: string; grade: number; unlocked: boolean };
  quiz_year: number;
  scores: Scores;
  top3: Domain[];
  renaissance: boolean;
  family_answers: FamilyAnswers | null;
  matches: Match[];
  coming_soon: { name: string; eden_band: string | null }[];
}): ResultsPayload {
  const kids = input.family_answers?.kids ?? '1';
  const base = {
    child_id: input.child.id,
    nickname: input.child.nickname,
    grade: input.child.grade,
    set_kind: setKindForGrade(input.child.grade),
    quiz_year: input.quiz_year,
    unlocked: input.child.unlocked,
    offers: { blueprint: true, family_map: kids !== '1' },
  };
  if (!input.child.unlocked) return { ...base, preview: { top_wiring: input.top3[0] } };
  return {
    ...base,
    scores: input.scores,
    top3: input.top3,
    renaissance: input.renaissance,
    approach: bestFitApproach(input.scores, input.renaissance, input.family_answers?.approach ?? null),
    tip_first: tipFirst(input.family_answers?.frustration),
    top_wiring: input.top3[0],
    matches: input.matches,
    coming_soon: input.coming_soon,
  };
}
