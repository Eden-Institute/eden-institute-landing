// supabase/functions/_shared/wired-raters.ts
//
// Fearfully & Wonderfully Wired, W9: the other raters (spec 7.3 teen self-report, 7.4 observers,
// answers 11, 23, 28d). A rater opens a private link, answers the set for the child's band (teen: the
// teen-v1 parallel form), and the child's blend is recomputed: mom 50%, everyone else sharing 50%
// (DECIDED 11/17 + 11/18 "Exactly 50%", wired-engine blend()). Mom then gets an email: teen_ready or
// pdf_update (with the updated Blueprint attached when she has one).
//
// Links: a random 32-byte code shown or emailed once; only its SHA-256 is stored (wired_teen_links.token_hash,
// wired_observers.token_hash). Teen links: single use, 60 days, only for grade 9+ after mom picks an age of
// 13 or older from a neutral list (answer 28d, FTC COPPA FAQ H.3). Observer links: one per invite, single use
// per child per quiz year, 30 days (answer 11). No teen name or email is ever stored; an observer's email is
// used for the invite and one reminder only and is never put on a list.

import { blend, type BlendInput, quizYear, scoreRater, setKindForGrade, type RaterAnswers } from "./wired-engine.ts";
import { type Db, approvedCurricula, loadBank, pg, rpc } from "./wired-submit-flow.ts";
import { type FamilyAnswers, prefsFromAnswers } from "./wired-submit-core.ts";
import { rankCurricula } from "./wired-match.ts";

export type RaterKind = "teen" | "observer";
export const TEEN_LINK_DAYS = 60;
export const OBSERVER_LINK_DAYS = 30;
export const MAX_OBSERVERS = 3;
export const OBSERVER_LABELS = ["Dad", "Grandparent", "Co-op teacher", "Tutor", "Other family member", "Other"] as const;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** A fresh link code: 32 random bytes, URL-safe. Never stored; only its hash is. */
export function newLinkCode(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}
/**
 * An observer's link code: HMAC-SHA256(WIRED_LINK_SECRET, "observer:" + id), URL-safe. Derived, so the invite
 * and the one reminder carry the same link without the code ever being stored (only its hash is, for the
 * lookup). Never falls back to another secret (spec rule 11).
 */
export async function observerCode(observerId: string, secret: string | undefined = Deno.env.get("WIRED_LINK_SECRET")): Promise<string> {
  if (!secret || secret.length < 32) throw new Error("WIRED_LINK_SECRET is missing or too short");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`observer:${observerId}`))));
}
export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const isLinkCode = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{40,48}$/.test(v);

export interface RaterContext {
  kind: RaterKind;
  linkId: string;            // wired_teen_links.id or wired_observers.id
  familyId: string;
  childId: string;
  nickname: string;
  grade: number;
  quizYear: number;
  setKind: string;
  momName: string | null;
  label: string | null;      // observer label
}
export type ResolveError = "invalid_link" | "expired" | "used" | "removed";

interface ChildJoin { id: string; family_id: string; nickname: string; grade: number; removed_at: string | null; wired_families: { first_name: string | null } | null }

export async function resolveRaterLink(db: Db, kind: RaterKind, code: unknown, now: Date = new Date()): Promise<RaterContext | { error: ResolveError }> {
  if (!isLinkCode(code)) return { error: "invalid_link" };
  const hash = await sha256Hex(code);
  const childSel = "wired_children!inner(id,family_id,nickname,grade,removed_at,wired_families!inner(first_name))";
  if (kind === "teen") {
    const row = (await pg<{ id: string; quiz_year: number; expires_at: string; used_at: string | null; wired_children: ChildJoin }[]>(db,
      `wired_teen_links?token_hash=eq.${hash}&select=id,quiz_year,expires_at,used_at,${childSel}&limit=1`))?.[0];
    if (!row) return { error: "invalid_link" };
    if (row.used_at) return { error: "used" };
    if (Date.parse(row.expires_at) <= now.getTime()) return { error: "expired" };
    const c = row.wired_children;
    if (c.removed_at) return { error: "removed" };
    return { kind, linkId: row.id, familyId: c.family_id, childId: c.id, nickname: c.nickname, grade: c.grade, quizYear: row.quiz_year, setKind: "teen", momName: c.wired_families?.first_name ?? null, label: null };
  }
  const row = (await pg<{ id: string; family_id: string; label: string | null; email: string | null; token_expires_at: string | null; removed_at: string | null; quiz_year: number | null; last_completed_quiz_year: number | null; wired_children: ChildJoin }[]>(db,
    `wired_observers?token_hash=eq.${hash}&select=id,family_id,label,email,token_expires_at,removed_at,quiz_year,last_completed_quiz_year,${childSel}&limit=1`))?.[0];
  if (!row) return { error: "invalid_link" };
  if (row.removed_at || !row.email) return { error: "removed" };
  const year = row.quiz_year ?? quizYear(now);
  if (row.last_completed_quiz_year !== null && row.last_completed_quiz_year >= year) return { error: "used" };
  if (!row.token_expires_at || Date.parse(row.token_expires_at) <= now.getTime()) return { error: "expired" };
  const c = row.wired_children;
  if (c.removed_at) return { error: "removed" };
  return { kind, linkId: row.id, familyId: row.family_id, childId: c.id, nickname: c.nickname, grade: c.grade, quizYear: year, setKind: setKindForGrade(c.grade), momName: c.wired_families?.first_name ?? null, label: row.label };
}

export type RaterOutcome =
  | { status: "ok"; sessionId: string }
  | { status: "already_completed" }
  | { status: "no_mom_quiz" }
  | { status: "bad_request"; message: string };

/**
 * Score one teen/observer submission and recompute the child's blend through the ONE writer (wired_submit
 * RPC, rater_role teen/observer). Then mark the link used and queue mom's email.
 */
export async function processRaterSubmission(db: Db, ctx: RaterContext, bankVersion: string, answers: RaterAnswers, now: Date = new Date()): Promise<RaterOutcome> {
  const bank = await loadBank(db, bankVersion);
  if (!bank) return { status: "bad_request", message: `unknown bank_version ${bankVersion}` };
  if (bank.set_kind !== ctx.setKind) return { status: "bad_request", message: `this link needs the ${ctx.setKind} questions` };
  let result;
  try {
    result = scoreRater(bank, answers);
  } catch (err) {
    return { status: "bad_request", message: err instanceof Error ? err.message : String(err) };
  }
  const fam = (await pg<{ email: string }[]>(db, `wired_families?id=eq.${ctx.familyId}&select=email&limit=1`))?.[0];
  if (!fam) return { status: "bad_request", message: "family not found" };

  for (let attempt = 0; attempt < 2; attempt++) {
    const sessions = await pg<{ id: string; rater_role: "mom" | "teen" | "observer"; bank_version: string; raw_answers: RaterAnswers; family_answers: FamilyAnswers | null }[]>(db,
      `wired_sessions?child_id=eq.${ctx.childId}&quiz_year=eq.${ctx.quizYear}&completed_at=not.is.null&is_pilot_retake=eq.false&select=id,rater_role,bank_version,raw_answers,family_answers&order=id.asc`);
    const mom = (sessions ?? []).find((s) => s.rater_role === "mom");
    if (!mom?.family_answers) return { status: "no_mom_quiz" };
    const raters: BlendInput[] = [];
    for (const s of sessions ?? []) {
      const b = await loadBank(db, s.bank_version);
      if (!b) throw new Error(`stored session ${s.id} names bank ${s.bank_version}, which is missing`);
      raters.push({ role: s.rater_role, session_id: s.id, result: scoreRater(b, s.raw_answers) });
    }
    const blended = blend([...raters, { role: ctx.kind, session_id: "new", result }]);
    const snap = (await pg<{ matches_snapshot: { ranking?: string[] } | null }[]>(db,
      `wired_results?child_id=eq.${ctx.childId}&quiz_year=eq.${ctx.quizYear}&select=matches_snapshot&limit=1`))?.[0];
    const prefs = (await pg<{ priority_ranking: string[] | null }[]>(db, `wired_family_prefs?family_id=eq.${ctx.familyId}&select=priority_ranking&limit=1`))?.[0];
    // Mom's stored family answers carry her plan_year, so the re-blend keeps her planning grade (2026-11-22).
    const ranked = rankCurricula({
      grade: ctx.grade, scores: blended.blended_scores, top3: blended.top3,
      prefs: prefsFromAnswers(mom.family_answers, prefs?.priority_ranking ?? snap?.matches_snapshot?.ranking ?? null),
      curricula: await approvedCurricula(db),
    });
    const r = await rpc(db, {
      email: fam.email, first_name: null, email_hash: "", quiz_year: ctx.quizYear, bank_version: bankVersion,
      raw_answers: answers, scores: result.scores, top3: result.top3, renaissance: result.renaissance,
      engine_version: result.engine_version, attribution: {},
      child: { nickname: ctx.nickname, grade: ctx.grade }, child_id: ctx.childId,
      rater_role: ctx.kind, observer_id: ctx.kind === "observer" ? ctx.linkId : null, family_answers: null,
      results: {
        blended_scores: blended.blended_scores, top3: blended.top3, renaissance: blended.renaissance,
        weights: blended.weights, expected_session_ids: raters.map((x) => x.session_id),
        matches_snapshot: { matches: ranked.matches, coming_soon: ranked.coming_soon, ranking: ranked.ranking, match_version: ranked.match_version, planning_grade: ranked.planning_grade },
        engine_version: blended.engine_version,
      },
    });
    if (r.status === "stale_blend") continue;
    if (r.status === "already_completed") { await markUsed(db, ctx, now); return { status: "already_completed" }; }
    if (r.status !== "ok") return { status: "bad_request", message: String(r.status) };
    await markUsed(db, ctx, now);
    try {
      await pg(db, "wired_email_queue", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          family_id: ctx.familyId, child_id: ctx.childId, email: fam.email.trim().toLowerCase(),
          observer_id: ctx.kind === "observer" ? ctx.linkId : null,
          kind: ctx.kind === "teen" ? "teen_ready" : "pdf_update", scheduled_for: now.toISOString(),
        }),
      });
    } catch (err) {
      console.error("wired rater: could not queue mom's email:", err instanceof Error ? err.message : String(err));
    }
    return { status: "ok", sessionId: r.session_id };
  }
  throw new Error("another rater kept finishing at the same moment (stale blend twice)");
}

async function markUsed(db: Db, ctx: RaterContext, now: Date): Promise<void> {
  if (ctx.kind === "teen") {
    await pg(db, `wired_teen_links?id=eq.${ctx.linkId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ used_at: now.toISOString() }) });
  } else {
    await pg(db, `wired_observers?id=eq.${ctx.linkId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_completed_quiz_year: ctx.quizYear }) });
  }
}

/** Mint a teen link for a grade 9+ child (age 13+ already checked by the caller). Returns the code once. */
export async function mintTeenLink(db: Db, childId: string, now: Date = new Date()): Promise<string> {
  const code = newLinkCode();
  await pg(db, "wired_teen_links", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ child_id: childId, quiz_year: quizYear(now), token_hash: await sha256Hex(code), expires_at: new Date(now.getTime() + TEEN_LINK_DAYS * 86_400_000).toISOString() }),
  });
  return code;
}
