// supabase/functions/_shared/wired-pilot.ts
//
// Fearfully & Wonderfully Wired, W12: the pilot (spec section 13, answer 33; approved copy
// Wired_Quiz_Pilot_Pieces.md, 2026-11-19 3:21 PM CT). DARK behind the WIRED_PILOT_OPEN secret.
//
// The unlock ladder (DECIDED 11/17, chapters per Lane 8 11/20: Ch 1 at step 3, Ch 4 at step 4):
//   step 1  her quiz + Survey 1 (ux, UMUX-LITE)     -> the Learner Blueprint (pilot_blueprint) for that child
//   step 2  Survey 2 (accuracy)                     -> the Family Learning Map (pilot_family_map)
//   step 3  Survey 3 (family_map), ~2 weeks later   -> advance Ch 1 + the Founding Families list (only with permission)
//   step 4  the 30-day retake + Survey 4 (retake)   -> advance Ch 4
// Every survey unlocks the next reward whatever the feedback (16 CFR 465.4); nothing here reads the answers to
// decide a reward. Chapter files are attached later by Lane 8: until PILOT_CHAPTER_1_URL / PILOT_CHAPTER_4_URL are
// set, those steps are recorded and nothing is sent ("inert", spec section 13).

import { type Db, loadBank, pg, rpc } from "./wired-submit-flow.ts";
import { quizYear, scoreRater, setKindForGrade, type RaterAnswers } from "./wired-engine.ts";

export type SurveyKind = "ux" | "accuracy" | "family_map" | "retake";
export const SURVEY_ORDER: SurveyKind[] = ["ux", "accuracy", "family_map", "retake"];
/** Survey 3 opens about 2 weeks after Survey 2 (12 days, so a weekend never pushes it to week 3). */
export const STEP3_AFTER_DAYS = 12;
/** The retake opens 30 days after her first quiz for that child (the "one-month stability check"). */
export const RETAKE_AFTER_DAYS = 30;

export const YEARS = ["starting", "under_1", "1_2", "3_5", "6_plus"] as const;
export const KIDS = ["1", "2", "3", "4", "5plus"] as const;
export const HEARD = ["facebook_group", "instagram", "podcast", "eden_email", "friend", "other"] as const;
export const APPROACHES = ["classical", "charlotte_mason", "traditional", "unit_study", "literature", "montessori", "waldorf", "interest_led", "online", "eclectic", "starting", "unsure"] as const;
const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export function bandOfGrade(g: number): "K-2" | "3-5" | "6-8" | "9-12" {
  return g <= 2 ? "K-2" : g <= 5 ? "3-5" : g <= 8 ? "6-8" : "9-12";
}

export interface Application {
  email: string; first_name: string | null; state: string; years: string; kids: string;
  children: { nickname: string; grade: number }[]; bands: string[]; approach: string; heard: string; commitment: true;
}

/** The approved form, checked. Children: 1-8, nickname 1-40 characters (no last names asked), grade K (0) to 12. */
export function parseApplication(b: Record<string, unknown>): { ok: true; value: Application } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) errors.push("email");
  const first = typeof b.first_name === "string" ? b.first_name.trim().slice(0, 60) : "";
  if (!first) errors.push("first_name");
  const state = typeof b.state === "string" ? b.state.toUpperCase() : "";
  if (!STATES.includes(state)) errors.push("state");
  const pick = (k: string, list: readonly string[]) => (typeof b[k] === "string" && list.includes(b[k] as string) ? (b[k] as string) : (errors.push(k), ""));
  const years = pick("years", YEARS);
  const kids = pick("kids", KIDS);
  const approach = pick("approach", APPROACHES);
  const heard = pick("heard", HEARD);
  const kidsIn = Array.isArray(b.children) ? b.children : [];
  const children = kidsIn.slice(0, 8).map((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const nickname = typeof o.nickname === "string" ? o.nickname.replace(/\s+/g, " ").trim().slice(0, 40) : "";
    const grade = Number(o.grade);
    return { nickname, grade };
  }).filter((c) => c.nickname && Number.isInteger(c.grade) && c.grade >= 0 && c.grade <= 12);
  if (!children.length || children.length !== kidsIn.length) errors.push("children");
  if (b.commitment !== true) errors.push("commitment");
  if (errors.length) return { ok: false, errors };
  const bands = [...new Set(children.map((c) => bandOfGrade(c.grade)))];
  return { ok: true, value: { email, first_name: first, state, years, kids, children, bands, approach, heard, commitment: true } };
}

/**
 * UMUX-LITE (Lewis, Utesch and Maher, CHI 2013): two 7-point items. raw = ((a-1)+(b-1)) * 100/12;
 * the published regression-adjusted score = 0.65 * raw + 22.9 (answer 33). Both kept with the answers.
 */
export function umuxLite(a: number, b: number): { raw: number; adjusted: number } {
  const raw = ((a - 1) + (b - 1)) * 100 / 12;
  return { raw: Math.round(raw * 10) / 10, adjusted: Math.round((0.65 * raw + 22.9) * 10) / 10 };
}

/** Light shape checks per survey (every question but the required ones is optional, as approved). */
export function checkSurvey(kind: SurveyKind, a: Record<string, unknown>): string | null {
  const scale7 = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 7;
  const text = (v: unknown, max = 2000) => v === undefined || v === null || (typeof v === "string" && v.length <= max);
  for (const [k, v] of Object.entries(a)) if (typeof v === "string" && v.length > 2000) return `${k} is too long`;
  if (kind === "ux") {
    if (!scale7(a.capabilities) || !scale7(a.easy)) return "the two 1-7 questions are required";
    if (!text(a.confusing) || !text(a.fix)) return "text too long";
    return null;
  }
  if (kind === "accuracy") return typeof a.overall === "string" ? null : "the first question is required";
  if (kind === "family_map") {
    if (typeof a.recommend !== "string") return "the recommend question is required";
    if (a.badge_name !== undefined && a.badge_name !== null && (typeof a.badge_name !== "string" || a.badge_name.length > 80)) return "badge name too long";
    if (a.quote !== undefined && a.quote !== null && (typeof a.quote !== "string" || a.quote.length > 600)) return "quote too long";
    return null;
  }
  return typeof a.big_change === "string" && typeof a.answered_differently === "string" ? null : "both questions are required";
}

interface Progress { family_id: string; child_id: string | null; step1_at: string | null; step2_at: string | null; step3_at: string | null; step4_at: string | null }

/** Is this family a selected pilot tester? (The application is matched by the family's own email.) */
export async function selectedPilot(db: Db, email: string): Promise<boolean> {
  const a = (await pg<{ status: string }[]>(db, `wired_pilot_applications?email=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=status&limit=1`))?.[0];
  return a?.status === "selected";
}

export async function getProgress(db: Db, familyId: string): Promise<Progress | null> {
  return (await pg<Progress[]>(db, `wired_pilot_progress?family_id=eq.${familyId}&select=family_id,child_id,step1_at,step2_at,step3_at,step4_at&limit=1`))?.[0] ?? null;
}

async function firstMomQuiz(db: Db, familyId: string, childId: string): Promise<{ id: string; completed_at: string } | null> {
  return (await pg<{ id: string; completed_at: string }[]>(db,
    `wired_sessions?family_id=eq.${familyId}&child_id=eq.${childId}&rater_role=eq.mom&is_pilot_retake=eq.false&completed_at=not.is.null&select=id,completed_at&order=completed_at.asc&limit=1`))?.[0] ?? null;
}

/** What she can do next: the next survey, when it opens, and whether the retake quiz is due. */
export async function nextStep(db: Db, familyId: string, childId: string, now: Date = new Date()): Promise<{ next: SurveyKind | "done"; opens_at: string | null; retake_needed: boolean }> {
  const p = await getProgress(db, familyId);
  if (!p?.step1_at) return { next: "ux", opens_at: null, retake_needed: false };
  if (!p.step2_at) return { next: "accuracy", opens_at: null, retake_needed: false };
  if (!p.step3_at) {
    const opens = new Date(Date.parse(p.step2_at) + STEP3_AFTER_DAYS * 86_400_000);
    return { next: "family_map", opens_at: opens > now ? opens.toISOString() : null, retake_needed: false };
  }
  if (!p.step4_at) {
    const first = await firstMomQuiz(db, familyId, p.child_id ?? childId);
    const opens = first ? new Date(Date.parse(first.completed_at) + RETAKE_AFTER_DAYS * 86_400_000) : null;
    const retake = await pg<{ id: string }[]>(db, `wired_sessions?family_id=eq.${familyId}&child_id=eq.${p.child_id ?? childId}&is_pilot_retake=eq.true&completed_at=not.is.null&select=id&limit=1`);
    return { next: "retake", opens_at: opens && opens > now ? opens.toISOString() : null, retake_needed: !(retake ?? []).length };
  }
  return { next: "done", opens_at: null, retake_needed: false };
}

export type SurveyOutcome =
  | { status: "ok"; step: number; unlocked: string | null; chapter?: "sent" | "pending" }
  | { status: "not_yet"; opens_at?: string | null; reason: string }
  | { status: "already" }
  | { status: "bad_request"; message: string };

/** Record one survey and give its reward (one transaction per unlock, wired_pilot_grant). */
export async function submitSurvey(db: Db, familyId: string, childId: string, kind: SurveyKind, answers: Record<string, unknown>, env: (k: string) => string | undefined = (k) => Deno.env.get(k), now: Date = new Date()): Promise<SurveyOutcome> {
  const bad = checkSurvey(kind, answers);
  if (bad) return { status: "bad_request", message: bad };
  const step = await nextStep(db, familyId, childId, now);
  if (step.next === "done") return { status: "already" };
  if (step.next !== kind) {
    return SURVEY_ORDER.indexOf(kind) < SURVEY_ORDER.indexOf(step.next as SurveyKind) ? { status: "already" } : { status: "not_yet", reason: `next is ${step.next}` };
  }
  if (step.opens_at) return { status: "not_yet", opens_at: step.opens_at, reason: "opens later" };
  if (kind === "retake" && step.retake_needed) return { status: "not_yet", reason: "retake the quiz first" };
  const first = await firstMomQuiz(db, familyId, childId);
  if (kind === "ux" && !first) return { status: "not_yet", reason: "take the quiz first" };

  const stored: Record<string, unknown> = { ...answers };
  if (kind === "ux") stored.umux_lite = umuxLite(answers.capabilities as number, answers.easy as number);
  await pg(db, "wired_surveys", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ family_id: familyId, child_id: childId, session_id: first?.id ?? null, kind, answers: stored }),
  });
  const year = quizYear(now);
  const stamp = now.toISOString();
  if (kind === "ux") {
    await pg(db, "wired_pilot_progress?on_conflict=family_id", {
      method: "POST", headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify({ family_id: familyId, child_id: childId, step1_at: stamp }),
    });
    await pg(db, "rpc/wired_pilot_grant", { method: "POST", body: JSON.stringify({ p_family: familyId, p_child: childId, p_product: "pilot_blueprint", p_quiz_year: year }) });
    return { status: "ok", step: 1, unlocked: "blueprint" };
  }
  if (kind === "accuracy") {
    await pg(db, `wired_pilot_progress?family_id=eq.${familyId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ step2_at: stamp }) });
    await pg(db, "rpc/wired_pilot_grant", { method: "POST", body: JSON.stringify({ p_family: familyId, p_child: childId, p_product: "pilot_family_map", p_quiz_year: year }) });
    return { status: "ok", step: 2, unlocked: "family_map" };
  }
  if (kind === "family_map") {
    const yes = (v: unknown) => typeof v === "string" && v.trim().toLowerCase() === "yes";
    const badge = yes(answers.badge) && typeof answers.badge_name === "string" && answers.badge_name.trim() ? answers.badge_name.trim() : null;
    const quote = typeof answers.quote === "string" && answers.quote.trim() ? answers.quote.trim() : null;
    await pg(db, `wired_pilot_progress?family_id=eq.${familyId}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ step3_at: stamp, badge_permission: !!badge, badge_name: badge, quote, quote_permission: !!quote && yes(answers.quote_permission) }),
    });
    return { status: "ok", step: 3, unlocked: "chapter_1", chapter: env("PILOT_CHAPTER_1_URL") ? "sent" : "pending" };
  }
  await pg(db, `wired_pilot_progress?family_id=eq.${familyId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ step4_at: stamp }) });
  return { status: "ok", step: 4, unlocked: "chapter_4", chapter: env("PILOT_CHAPTER_4_URL") ? "sent" : "pending" };
}

/**
 * The 30-day retake: her quiz again for the same child, stored as is_pilot_retake (kept for the reliability study,
 * never moves the results or the one-quiz-a-year rule, spec section 5). Only for a selected tester, only once the
 * retake has opened (30 days after her first quiz for that child), only once.
 */
export async function submitRetake(db: Db, familyId: string, childId: string, bankVersion: string, answers: RaterAnswers, now: Date = new Date()): Promise<{ status: "ok" | "not_yet" | "already" | "bad_request"; message?: string; opens_at?: string }> {
  const fam = (await pg<{ email: string }[]>(db, `wired_families?id=eq.${familyId}&select=email&limit=1`))?.[0];
  const kid = (await pg<{ nickname: string; grade: number }[]>(db, `wired_children?id=eq.${childId}&family_id=eq.${familyId}&removed_at=is.null&select=nickname,grade&limit=1`))?.[0];
  if (!fam || !kid) return { status: "bad_request", message: "unknown child" };
  const first = await firstMomQuiz(db, familyId, childId);
  if (!first) return { status: "not_yet", message: "take the quiz first" };
  const opens = new Date(Date.parse(first.completed_at) + RETAKE_AFTER_DAYS * 86_400_000);
  if (opens > now) return { status: "not_yet", opens_at: opens.toISOString() };
  const done = await pg<{ id: string }[]>(db, `wired_sessions?family_id=eq.${familyId}&child_id=eq.${childId}&is_pilot_retake=eq.true&completed_at=not.is.null&select=id&limit=1`);
  if ((done ?? []).length) return { status: "already" };
  const bank = await loadBank(db, bankVersion);
  if (!bank || bank.set_kind !== setKindForGrade(kid.grade)) return { status: "bad_request", message: "this child needs the " + setKindForGrade(kid.grade) + " questions" };
  let r;
  try { r = scoreRater(bank, answers); } catch (e) { return { status: "bad_request", message: e instanceof Error ? e.message : String(e) }; }
  const out = await rpc(db, {
    email: fam.email, first_name: null, email_hash: "", quiz_year: quizYear(now), bank_version: bankVersion,
    raw_answers: answers, scores: r.scores, top3: r.top3, renaissance: r.renaissance, engine_version: r.engine_version,
    attribution: { utm_campaign: "learner_quiz_pilot", placement: "pilot_retake" },
    child: { nickname: kid.nickname, grade: kid.grade }, child_id: childId, rater_role: "mom", is_pilot_retake: true,
    family_answers: null, results: {},
  });
  return out.status === "ok" ? { status: "ok" } : out.status === "already_completed" ? { status: "already" } : { status: "bad_request", message: String(out.status) };
}
