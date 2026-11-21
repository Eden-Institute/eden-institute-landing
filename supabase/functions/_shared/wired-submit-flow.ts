// supabase/functions/_shared/wired-submit-flow.ts
//
// Fearfully & Wonderfully Wired, W3: the I/O half of a submission, shared by wired-submit and
// wired-replay-failures (one path, so a replayed submission is processed exactly like a live
// one). Reads go through PostgREST with the service role; the ONE write is the
// public.wired_submit RPC (spec section 18 answer 9).

import { DRIP_DAYS } from './wired-email-learner.ts';
import { centralMorning } from './send-day-guard.ts';
import { type Bank, blend, type BlendInput, quizYear, scoreRater, scoreTeachingStyle, AnswerError } from './wired-engine.ts';
import { type EsaRow, rankCurricula, toMatchCurriculum } from './wired-match.ts';
import { buildResultsPayload, type FamilyAnswers, prefsFromAnswers, type ResultsPayload, type Submission } from './wired-submit-core.ts';
import { type BuyerRow, DISPLAY_COLUMNS, type DisplayRow, EXTRAS_COLUMNS, FAMILY_MAP_PRODUCTS, familyMapUpgrade, type UnlockRow } from './wired-display.ts';
import { verifyWiredToken } from './wired-token.ts';

export interface Db { url: string; key: string }

/** The RPC or the database could not be reached / answered 5xx: the caller dead-letters. */
export class WiredUnavailable extends Error {}
/** The submission can never succeed as sent (unknown bank, wrong set, bad answers): 400. */
export class WiredBadRequest extends Error {}

export async function pg<T = unknown>(db: Db, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${db.url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new WiredUnavailable(`fetch ${path.split('?')[0]}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = await res.text();
  if (res.status >= 500 || res.status === 0) throw new WiredUnavailable(`${path.split('?')[0]} ${res.status}: ${text.slice(0, 200)}`);
  if (!res.ok) throw new Error(`${path.split('?')[0]} ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}

const banks = new Map<string, Bank>();
export async function loadBank(db: Db, version: string): Promise<Bank | null> {
  if (banks.has(version)) return banks.get(version)!;
  const rows = await pg<{ bank: Bank }[]>(db, `wired_question_banks?version=eq.${encodeURIComponent(version)}&select=bank&limit=1`);
  const b = rows?.[0]?.bank ?? null;
  if (b) banks.set(version, b);
  return b;
}

export async function activeBank(db: Db, setKind: string): Promise<Bank | null> {
  const rows = await pg<{ bank: Bank }[]>(db, `wired_question_banks?set_kind=eq.${encodeURIComponent(setKind)}&active=eq.true&select=bank&limit=1`);
  return rows?.[0]?.bank ?? null;
}

/** SHA-256 of lower(email) with the server-side pepper (answer 10). No pepper = refuse. */
export async function emailHash(email: string, pepper: string): Promise<string> {
  if (!pepper || pepper.length < 32) throw new Error('WIRED_EMAIL_PEPPER is missing or too short');
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${pepper}:${email.trim().toLowerCase()}`));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const MATCH_COLUMNS = 'id,name,grade_min,grade_max,domains_served,prep_load,price_cents,multi_age,faith_alignment,approved,coming_soon,eden_band';

/** Spec answer 38 (2026-11-19): the quiz ranks resource_type = Curriculum ONLY; null = a row from before the column. */
export const CURRICULUM_ONLY_FILTER = 'or=(resource_type.is.null,resource_type.eq.Curriculum)';

export async function approvedCurricula(db: Db) {
  // Selecting the columns ranking may read, never is_affiliate / affiliate_url / dm_* (rule 3).
  // Helpful extras (apps, video libraries...) never enter the ranking (spec answer 38).
  const rows = await pg<Record<string, unknown>[]>(db, `wired_curricula?approved=eq.true&${CURRICULUM_ONLY_FILTER}&select=${MATCH_COLUMNS}`);
  return (rows ?? []).map(toMatchCurriculum);
}

export async function esaRows(db: Db, state: string): Promise<EsaRow[]> {
  return (await pg<EsaRow[]>(db, `wired_curriculum_esa?state=eq.${encodeURIComponent(state.toUpperCase())}&select=curriculum_id,state,eligible,verified_at`)) ?? [];
}

const UUID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Display fields for ranked matches (2026-11-21), read AFTER ranking (rule 3). Approved rows only. */
export async function matchDisplayRows(db: Db, ids: string[]): Promise<DisplayRow[]> {
  const ok = [...new Set(ids)].filter((id) => UUID_ONLY.test(id));
  if (!ok.length) return [];
  return (await pg<DisplayRow[]>(db, `wired_curricula?id=in.(${ok.join(',')})&approved=eq.true&select=${DISPLAY_COLUMNS}`)) ?? [];
}

/** The approved Helpful extras (spec answer 38): every row whose resource_type is set and is not "Curriculum". */
export async function helpfulExtraRows(db: Db): Promise<Record<string, unknown>[]> {
  return (await pg<Record<string, unknown>[]>(db, `wired_curricula?approved=eq.true&coming_soon=eq.false&resource_type=neq.Curriculum&select=${EXTRAS_COLUMNS}`)) ?? [];
}

/**
 * The later $28 upgrade for a family (spec 9.2), on create-checkout's exact gate: wired_buyers rows for the
 * CURRENT quiz year, a live Blueprint and no live Family Map. Returns the Blueprint child's nickname, or null.
 */
export async function familyMapUpgradeFor(db: Db, familyId: string, now: Date = new Date()): Promise<{ blueprint_nickname: string } | null> {
  if (!UUID_ONLY.test(familyId)) return null;
  const buys = (await pg<BuyerRow[]>(db,
    `wired_buyers?family_id=eq.${familyId}&quiz_year=eq.${quizYear(now)}&select=product,order_id,refunded_at,disputed_at,purchased_at&order=purchased_at.asc`)) ?? [];
  const live = buys.filter((b) => !b.refunded_at && !b.disputed_at);
  const orders = [...new Set(live.filter((b) => b.product === 'blueprint' && b.order_id).map((b) => b.order_id as string))].filter((id) => UUID_ONLY.test(id));
  if (!orders.length || live.some((b) => FAMILY_MAP_PRODUCTS.includes(b.product))) return null;
  const unlocks = (await pg<UnlockRow[]>(db,
    `wired_unlocks?family_id=eq.${familyId}&order_id=in.(${orders.join(',')})&product=eq.blueprint&select=order_id,child_id`)) ?? [];
  const kidIds = [...new Set(unlocks.map((u) => u.child_id).filter((id): id is string => !!id && UUID_ONLY.test(id)))];
  const kids = kidIds.length
    ? (await pg<{ id: string; nickname: string }[]>(db, `wired_children?family_id=eq.${familyId}&id=in.(${kidIds.join(',')})&select=id,nickname`)) ?? []
    : [];
  return familyMapUpgrade(buys, unlocks, new Map(kids.map((k) => [k.id, k.nickname])));
}

// ── Her own questions (the adult-v1 set) and the complete Family Map (2026-11-21, approved "Build it, as written") ──

/** July 1, 00:00 Central of a quiz year (July is always CDT, UTC-5): where that quiz year begins (answer 8). */
export function quizYearStart(year: number): Date {
  return new Date(Date.UTC(year, 6, 1, 5));
}

/**
 * For the results page's "Your own questions" box: does this family have a Family Map (paid or pilot: a
 * family_map PDF job) this quiz year, and has she answered her own questions this quiz year? Reads only this
 * family's rows.
 */
export async function familyMapOwnQuestions(db: Db, familyId: string, now: Date = new Date()): Promise<{ has_family_map: boolean; own_questions_answered: boolean }> {
  if (!UUID_ONLY.test(familyId)) return { has_family_map: false, own_questions_answered: false };
  const y = quizYear(now);
  const [maps, own] = await Promise.all([
    pg<unknown[]>(db, `wired_pdf_jobs?family_id=eq.${familyId}&kind=eq.family_map&quiz_year=eq.${y}&select=id&limit=1`),
    pg<unknown[]>(db, `wired_family_results?family_id=eq.${familyId}&quiz_year=eq.${y}&select=family_id&limit=1`),
  ]);
  return { has_family_map: (maps ?? []).length > 0, own_questions_answered: (own ?? []).length > 0 };
}

/**
 * Queue the complete Family Map ONCE after she answers her own questions: one pdf_update row with no child and no
 * observer (the transactional rail, so the one-a-day guard never holds it; wired-pdf's drain builds it). Only for a
 * family with a Family Map this quiz year, and never a second row this quiz year (her own set is also once a year:
 * wired_submit answers a repeat with already_completed). Returns whether a row was added.
 */
export async function queueFamilyMapUpdate(db: Db, familyId: string, email: string, now: Date = new Date()): Promise<boolean> {
  if (!UUID_ONLY.test(familyId)) return false;
  const y = quizYear(now);
  const map = await pg<{ id: string }[]>(db, `wired_pdf_jobs?family_id=eq.${familyId}&kind=eq.family_map&quiz_year=eq.${y}&select=id&limit=1`);
  if (!map?.length) return false;
  const since = encodeURIComponent(quizYearStart(y).toISOString());
  const existing = await pg<{ id: string }[]>(db,
    `wired_email_queue?family_id=eq.${familyId}&kind=eq.pdf_update&child_id=is.null&observer_id=is.null&created_at=gte.${since}&select=id&limit=1`);
  if (existing?.length) return false;
  await pg(db, 'wired_email_queue', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ family_id: familyId, child_id: null, observer_id: null, email: email.trim().toLowerCase(), kind: 'pdf_update', scheduled_for: now.toISOString() }),
  });
  return true;
}

/**
 * Her own questions sent from her private results page carry her results token, not an email (the page never holds
 * it). For that form ({set: 'adult', token}) the family's own email is read from the token's family and the token is
 * dropped (so a dead-lettered copy carries no token). Any other body comes back unchanged; a bad or expired token, or
 * a family that no longer exists, gives null (401).
 */
export async function adultBodyFromToken(db: Db, body: unknown): Promise<unknown | null> {
  if (!body || typeof body !== 'object') return body;
  const b = body as Record<string, unknown>;
  if (b.set !== 'adult' || b.token === undefined) return body;
  const grant = await verifyWiredToken(b.token, 'results');
  if (!grant) return null;
  const fam = (await pg<{ email: string }[]>(db, `wired_families?id=eq.${grant.familyId}&select=email&limit=1`))?.[0];
  if (!fam?.email) return null;
  const { token: _token, first_name: _first, ...rest } = b;
  return { ...rest, email: fam.email };
}

export type ProcessOutcome =
  | { status: 'ok'; family_id: string; child_id?: string; unlocked?: boolean; results?: ResultsPayload; family_map_update?: boolean }
  | { status: 'already_completed'; family_id: string; child_id?: string }
  | { status: 'unknown_child'; family_id: string };

/**
 * Score, blend, match and store one submission. Throws WiredBadRequest (400),
 * WiredUnavailable (dead-letter it) or Error (500).
 */
export async function processSubmission(db: Db, sub: Submission, opts: { pepper: string; now?: Date }): Promise<ProcessOutcome> {
  const now = opts.now ?? new Date();
  const bank = await loadBank(db, sub.bank_version);
  if (!bank) throw new WiredBadRequest(`unknown bank_version ${sub.bank_version}`);
  if (bank.set_kind !== sub.set_kind) throw new WiredBadRequest(`bank ${sub.bank_version} is the ${bank.set_kind} set, this quiz needs ${sub.set_kind}`);

  let rater;
  let teaching = null;
  try {
    rater = scoreRater(bank, sub.answers);
    if (bank.set_kind === 'adult') teaching = scoreTeachingStyle(bank, sub.answers.teaching ?? {});
  } catch (err) {
    if (err instanceof AnswerError) throw new WiredBadRequest(err.message);
    throw err;
  }
  const year = quizYear(now);
  const email_hash = await emailHash(sub.email, opts.pepper);
  const common = {
    email: sub.email, first_name: sub.first_name, email_hash, quiz_year: year, bank_version: sub.bank_version,
    raw_answers: sub.answers, scores: rater.scores, top3: rater.top3, renaissance: rater.renaissance,
    engine_version: rater.engine_version, attribution: sub.attribution,
  };

  if (!sub.child) {
    const r = await rpc(db, { ...common, child: null, teaching_style: teaching });
    if (r.status !== 'ok') return r as ProcessOutcome;
    // 2026-11-21: her first answers this year queue the complete Family Map once (when she has one). Like email 1,
    // a failure here never fails the submit (her answers are stored); it is logged for Lane 2.
    let family_map_update = false;
    try {
      family_map_update = await queueFamilyMapUpdate(db, r.family_id, sub.email, now);
    } catch (err) {
      console.error('wired-submit: could not queue the complete Family Map:', err instanceof Error ? err.message : String(err));
    }
    return { status: 'ok', family_id: r.family_id, family_map_update };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    // The raters already on record for this child this year (a first quiz has none).
    const onRecord = await raterRecord(db, sub, year);
    if (onRecord.momDone) {
      // One quiz per rater per child per year: her quiz for this child is already in.
      return { status: 'already_completed', family_id: onRecord.familyId!, child_id: onRecord.childId! };
    }
    const others = onRecord.raters;
    const blended = blend([...others, { role: 'mom', session_id: 'new', result: rater }]);
    const curricula = await approvedCurricula(db);
    const ranked = rankCurricula({
      grade: sub.child.grade, scores: blended.blended_scores, top3: blended.top3,
      prefs: prefsFromAnswers(sub.family_answers as FamilyAnswers, sub.ranking), curricula,
    });
    const r = await rpc(db, {
      ...common,
      child: sub.child, child_id: sub.child_id, rater_role: 'mom', family_answers: sub.family_answers,
      results: {
        blended_scores: blended.blended_scores, top3: blended.top3, renaissance: blended.renaissance,
        weights: blended.weights, expected_session_ids: others.map((o) => o.session_id),
        matches_snapshot: { matches: ranked.matches, coming_soon: ranked.coming_soon, ranking: ranked.ranking, match_version: ranked.match_version },
        engine_version: blended.engine_version,
      },
    });
    if (r.status === 'stale_blend') continue;
    if (r.status !== 'ok') return r as ProcessOutcome;
    // W8a: queue learner email 1 (results + the free PDF) for an unlocked child, once per child.
    // A failure here never fails the submit (her results are stored); it is logged for Lane 2.
    if (r.unlocked) {
      try {
        await queueEmailOne(db, r.family_id, r.child_id, sub.email);
      } catch (err) {
        console.error('wired-submit: could not queue email 1:', err instanceof Error ? err.message : String(err));
      }
      // W8b: the learner drip (emails 2-10), once per family, for this first unlocked child.
      try {
        await queueLearnerDrip(db, r.family_id, r.child_id, sub.email);
      } catch (err) {
        console.error('wired-submit: could not queue the learner drip:', err instanceof Error ? err.message : String(err));
      }
    }
    return {
      status: 'ok', family_id: r.family_id, child_id: r.child_id, unlocked: r.unlocked,
      results: buildResultsPayload({
        child: { id: r.child_id, nickname: sub.child.nickname, grade: sub.child.grade, unlocked: !!r.unlocked },
        quiz_year: year, scores: blended.blended_scores, top3: blended.top3, renaissance: blended.renaissance,
        family_answers: sub.family_answers, matches: ranked.matches, coming_soon: ranked.coming_soon,
      }),
    };
  }
  throw new WiredUnavailable('another rater kept finishing at the same moment (stale blend twice)');
}

/**
 * Who has already rated this child this year. The RPC re-checks the same set under the
 * family lock (blend guard), so a rater finishing in between turns into a retry, never a
 * wrong blend. A session whose bank cannot be loaded is a server fault (it was valid when
 * stored), so it throws rather than being silently left out of the blend.
 */
async function raterRecord(db: Db, sub: Submission, year: number): Promise<{ familyId: string | null; childId: string | null; momDone: boolean; raters: BlendInput[] }> {
  const none = { familyId: null, childId: null, momDone: false, raters: [] as BlendInput[] };
  const fam = await pg<{ id: string }[]>(db, `wired_families?email=eq.${encodeURIComponent(sub.email)}&select=id&limit=1`);
  const familyId = fam?.[0]?.id ?? null;
  if (!familyId) return none;
  let childId = sub.child_id;
  if (!childId) {
    const kids = await pg<{ id: string; nickname: string }[]>(db, `wired_children?family_id=eq.${familyId}&removed_at=is.null&select=id,nickname&order=created_at.asc`);
    childId = kids?.find((k) => k.nickname.toLowerCase() === sub.child!.nickname.toLowerCase())?.id ?? null;
  }
  if (!childId) return { ...none, familyId };
  const sessions = await pg<{ id: string; rater_role: 'mom' | 'teen' | 'observer'; bank_version: string; raw_answers: Submission['answers'] }[]>(
    db,
    `wired_sessions?child_id=eq.${childId}&family_id=eq.${familyId}&quiz_year=eq.${year}&completed_at=not.is.null&is_pilot_retake=eq.false&select=id,rater_role,bank_version,raw_answers&order=id.asc`,
  );
  const raters: BlendInput[] = [];
  let momDone = false;
  for (const s of sessions ?? []) {
    if (s.rater_role === 'mom') {
      momDone = true;
      continue;
    }
    const b = await loadBank(db, s.bank_version);
    if (!b) throw new Error(`stored session ${s.id} names bank ${s.bank_version}, which is missing`);
    raters.push({ role: s.rater_role, session_id: s.id, result: scoreRater(b, s.raw_answers) });
  }
  return { familyId, childId, momDone, raters };
}

export async function rpc(db: Db, p: Record<string, unknown>): Promise<Record<string, any>> {
  return await pg<Record<string, any>>(db, 'rpc/wired_submit', { method: 'POST', body: JSON.stringify({ p }) });
}

/** W8a: one email-1 row per child (a July retake's email is W8b's job, not a second email 1). */
export async function queueEmailOne(db: Db, familyId: string, childId: string, email: string, now: Date = new Date()): Promise<boolean> {
  const existing = await pg<{ id: string }[]>(db, `wired_email_queue?child_id=eq.${childId}&kind=eq.drip&position=eq.1&select=id&limit=1`);
  if (existing?.length) return false;
  await pg(db, 'wired_email_queue', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ family_id: familyId, child_id: childId, email: email.trim().toLowerCase(), kind: 'drip', position: 1, scheduled_for: now.toISOString() }),
  });
  return true;
}

/**
 * W8b: queue learner emails 2-10 (kind 'drip') on days 2, 4, 7, 10, 13, 16, 20, 25, 30 after the quiz
 * (spec answer 35), each at 8 AM Central on that day (the house send time). ONE drip per family: it follows the family's first unlocked child, and a later child
 * does not start a second series (email 10 is the "take it for another child" note). Position 9 (pilot
 * quotes) is NOT queued until 3+ Camila-approved pilot quotes exist (answer 35); the one-a-day guard may
 * move any of these by a day at send time.
 */
export const LEARNER_DRIP_POSITIONS = [2, 3, 4, 5, 6, 7, 8, 10] as const;
export async function queueLearnerDrip(db: Db, familyId: string, childId: string, email: string, now: Date = new Date()): Promise<number> {
  const existing = await pg<{ id: string }[]>(db, `wired_email_queue?family_id=eq.${familyId}&kind=eq.drip&position=gte.2&select=id&limit=1`);
  if (existing?.length) return 0;
  const rows = LEARNER_DRIP_POSITIONS.map((position) => ({
    family_id: familyId, child_id: childId, email: email.trim().toLowerCase(), kind: 'drip', position,
    scheduled_for: centralMorning(now, DRIP_DAYS[position]).toISOString(),
  }));
  await pg(db, 'wired_email_queue', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
  return rows.length;
}
