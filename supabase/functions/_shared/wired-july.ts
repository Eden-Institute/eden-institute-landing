// supabase/functions/_shared/wired-july.ts
// Queues the July 1 / July 15 check-in emails (spec 7.5, answer 35). Called by wired-cron daily.

import { type Db, pg } from "./wired-submit-flow.ts";
import { centralDay, centralMorning } from "./send-day-guard.ts";
import { quizYear } from "./wired-engine.ts";

/** Which July email a Central date gets: position 1 on July 1, position 2 on July 15, else none. */
export function julyPositionFor(day: string): 1 | 2 | null {
  const md = day.slice(5);
  return md === "07-01" ? 1 : md === "07-15" ? 2 : null;
}

interface ResultRow { child_id: string; wired_children: { family_id: string; removed_at: string | null; wired_families: { email: string; deleted_at: string | null } | null } | null }

export async function queueJuly(db: Db, asOf: Date, dryRun = false): Promise<Record<string, unknown>> {
  const day = centralDay(asOf);
  const position = julyPositionFor(day);
  if (!position) return { position: null, queued: 0 };
  const prior = quizYear(asOf) - 1; // on July 1 the new quiz year has just begun
  const rows = await pg<ResultRow[]>(db,
    `wired_results?quiz_year=eq.${prior}&select=child_id,wired_children!inner(family_id,removed_at,wired_families!inner(email,deleted_at))`);
  const families = new Map<string, string>();
  for (const r of rows ?? []) {
    const c = r.wired_children;
    if (!c || c.removed_at || !c.wired_families || c.wired_families.deleted_at) continue;
    families.set(c.family_id, c.wired_families.email);
  }
  // One row per family per date: skip families already queued for this July email this year.
  const since = new Date(asOf.getTime() - 20 * 86_400_000).toISOString();
  const done = new Set((await pg<{ family_id: string }[]>(db,
    `wired_email_queue?kind=eq.july&position=eq.${position}&created_at=gte.${encodeURIComponent(since)}&select=family_id`) ?? []).map((r) => r.family_id));
  const at = centralMorning(asOf, 0);
  const scheduled = (at > asOf ? at : asOf).toISOString();
  const toQueue = [...families].filter(([id]) => !done.has(id)).map(([family_id, email]) => ({
    family_id, email: email.trim().toLowerCase(), child_id: null, kind: "july", position, scheduled_for: scheduled,
  }));
  if (toQueue.length && !dryRun) {
    await pg(db, "wired_email_queue", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(toQueue) });
  }
  return { position, prior_quiz_year: prior, families: families.size, already: done.size, queued: dryRun ? 0 : toQueue.length, would_queue: toQueue.length };
}
