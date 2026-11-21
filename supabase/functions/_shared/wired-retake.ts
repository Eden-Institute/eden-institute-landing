// supabase/functions/_shared/wired-retake.ts
//
// Fearfully & Wonderfully Wired: the July yearly retest pre-fill (spec 7.5; approved em-july1 "We'll assume
// [Nickname] is moving up to grade [n+1]. You can confirm or fix that at the start.").
//
// The July 1 / July 15 button carries a signed link (wired-token purpose 'retake', family + child, HMAC with
// WIRED_LINK_SECRET) to the private page /wired/retake (no analytics or pixels, rule 7). The link holds no
// child data; wired-retake resolves it here to the child's nickname, the assumed grade and her email, and the
// quiz island fills them in. Mom confirms or fixes the grade before the questions, so the question set (which
// switches at grades 3, 6 and 9) follows the confirmed grade. She submits with the child's id: wired_submit
// binds the quiz to that child, updates the grade, and its one-quiz-per-rater-per-child-per-year rule means
// this is the child's one free yearly retest (no new free slot is used for an existing child) and that no
// mid-year retest is possible (the pilot's 30-day retake is its own path).

import { type Db, pg } from "./wired-submit-flow.ts";
import { quizYear } from "./wired-engine.ts";
import { type WiredGrant } from "./wired-token.ts";

export const RETAKE_PAGE = "https://edeninstitute.health/wired/retake";

export type RetakeContext =
  | { status: "ok"; child_id: string; nickname: string; grade: number; email: string }
  | { status: "already" | "not_due" | "unknown" };

/** The grade the July email assumes (same rule as wired-email-drain): the child's grade plus the years since
 *  the last quiz. Above 12 = graduated, no retest (the email skips that child too). */
export function assumedGrade(grade: number, lastQuizYear: number, thisYear: number): number {
  return grade + Math.max(0, thisYear - lastQuizYear);
}

export async function retakeContext(db: Db, grant: WiredGrant, now: Date = new Date()): Promise<RetakeContext> {
  if (!grant.childId) return { status: "unknown" };
  const fam = (await pg<{ email: string }[]>(db, `wired_families?id=eq.${grant.familyId}&select=email&limit=1`))?.[0];
  if (!fam) return { status: "unknown" };
  const child = (await pg<{ id: string; nickname: string; grade: number; unlocked_via: string | null }[]>(db,
    `wired_children?id=eq.${grant.childId}&family_id=eq.${grant.familyId}&removed_at=is.null&select=id,nickname,grade,unlocked_via&limit=1`))?.[0];
  // Only a child who had results (free slot or unlocked) gets a yearly retest.
  if (!child || child.unlocked_via === null) return { status: "unknown" };
  const last = (await pg<{ quiz_year: number }[]>(db,
    `wired_results?child_id=eq.${child.id}&select=quiz_year&order=quiz_year.desc&limit=1`))?.[0];
  if (!last) return { status: "not_due" };
  const thisYear = quizYear(now);
  if (last.quiz_year >= thisYear) return { status: "already" };
  const grade = assumedGrade(child.grade, last.quiz_year, thisYear);
  if (grade > 12) return { status: "not_due" };
  return { status: "ok", child_id: child.id, nickname: child.nickname, grade, email: fam.email };
}
