// supabase/functions/_shared/wired-submit-flow.ts
//
// Fearfully & Wonderfully Wired, W3: the I/O half of a submission, shared by wired-submit and
// wired-replay-failures (one path, so a replayed submission is processed exactly like a live
// one). Reads go through PostgREST with the service role; the ONE write is the
// public.wired_submit RPC (spec section 18 answer 9).

import { type Bank, blend, type BlendInput, quizYear, scoreRater, scoreTeachingStyle, AnswerError } from './wired-engine.ts';
import { type EsaRow, rankCurricula, toMatchCurriculum } from './wired-match.ts';
import { buildResultsPayload, type FamilyAnswers, prefsFromAnswers, type ResultsPayload, type Submission } from './wired-submit-core.ts';

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

export type ProcessOutcome =
  | { status: 'ok'; family_id: string; child_id?: string; unlocked?: boolean; results?: ResultsPayload }
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
    return r.status === 'ok' ? { status: 'ok', family_id: r.family_id } : r as ProcessOutcome;
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

async function rpc(db: Db, p: Record<string, unknown>): Promise<Record<string, any>> {
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
