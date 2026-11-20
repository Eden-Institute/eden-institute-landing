// supabase/functions/_shared/wired-observer-cron.ts
// W9 daily jobs, run by wired-cron (spec 7.4, section 4 deletion rule, answer 11, answer 32):
//   1. The ONE reminder: 5 days after the invite, only if they have not answered, only while the link works,
//      never twice (an existing reminder row or reminder_sent_at stops it).
//   2. The deletion sweep: an observer's email is hard-deleted after 2 Julys in a row with no retest of that
//      child (the child's latest results are from 2+ quiz years ago). Removal by mom and her data deletion
//      are handled at once by wired-observers / wired-delete.

import { type Db, pg } from "./wired-submit-flow.ts";
import { quizYear } from "./wired-engine.ts";

export const REMINDER_AFTER_DAYS = 5;

interface Obs { id: string; family_id: string; child_id: string; email: string | null; invited_at: string | null; quiz_year: number | null; last_completed_quiz_year: number | null; token_expires_at: string | null }

export async function queueObserverReminders(db: Db, now: Date = new Date(), dryRun = false): Promise<Record<string, number>> {
  const cutoff = new Date(now.getTime() - REMINDER_AFTER_DAYS * 86_400_000).toISOString();
  const due = (await pg<Obs[]>(db,
    `wired_observers?removed_at=is.null&email=not.is.null&reminder_sent_at=is.null&invited_at=lte.${encodeURIComponent(cutoff)}` +
    `&token_expires_at=gt.${encodeURIComponent(now.toISOString())}&select=id,family_id,child_id,email,invited_at,quiz_year,last_completed_quiz_year,token_expires_at`)) ?? [];
  let queued = 0, answered = 0, already = 0;
  for (const o of due) {
    if (o.last_completed_quiz_year !== null && o.last_completed_quiz_year >= (o.quiz_year ?? quizYear(now))) { answered++; continue; }
    const had = await pg<{ id: string }[]>(db, `wired_email_queue?observer_id=eq.${o.id}&kind=eq.observer_reminder&select=id&limit=1`);
    if (had?.length) { already++; continue; }
    if (!dryRun) {
      await pg(db, "wired_email_queue", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ family_id: o.family_id, child_id: o.child_id, observer_id: o.id, email: o.email, kind: "observer_reminder", scheduled_for: now.toISOString() }),
      });
    }
    queued++;
  }
  return { due: due.length, queued: dryRun ? 0 : queued, would_queue: queued, answered, already };
}

export async function sweepObserverEmails(db: Db, now: Date = new Date(), dryRun = false): Promise<Record<string, number>> {
  const year = quizYear(now);
  const live = (await pg<Obs[]>(db, `wired_observers?email=not.is.null&select=id,child_id`)) ?? [];
  let deleted = 0;
  for (const o of live) {
    const last = (await pg<{ quiz_year: number }[]>(db, `wired_results?child_id=eq.${o.child_id}&select=quiz_year&order=quiz_year.desc&limit=1`))?.[0];
    if (!last || year - last.quiz_year < 2) continue;
    if (!dryRun) {
      await pg(db, `wired_email_queue?observer_id=eq.${o.id}&sent_at=is.null&failed_at=is.null&skipped_reason=is.null`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ skipped_reason: "observer_email_deleted" }),
      });
      await pg(db, `wired_email_queue?observer_id=eq.${o.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ email: "removed@invalid" }) });
      await pg(db, `wired_observers?id=eq.${o.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ email: null, token_hash: null, deleted_at: now.toISOString() }),
      });
    }
    deleted++;
  }
  return { checked: live.length, deleted: dryRun ? 0 : deleted, would_delete: deleted };
}
