// supabase/functions/_shared/wired-staleness.ts
// Wired quiz W10 (spec section 12, answer 17): the curriculum staleness rows on the punch list, run daily by
// wired-cron.
//   - One founder_punch_list row per APPROVED curriculum not verified in 6 months (or never verified), titled
//     "Wired quiz: re-verify <name> (<publisher>)". A row counts as existing while it is open or deferred
//     (a partial unique index backs this up); after she marks it done, a later stale period makes a fresh one.
//   - Closed automatically (status done) once the curriculum is re-verified, unapproved or gone.
//   - On June 1 (Central): "Wired quiz: June sweep (prices + ESA) before the July 1 retest emails".
// The daily digest shows ONE count-only line (never the list, her 11/5 rule): staleCount() below.

import { type Db, pg } from "./wired-submit-flow.ts";
import { centralDay } from "./send-day-guard.ts";

export const STALE_MONTHS = 6;
export const REVERIFY_PREFIX = "Wired quiz: re-verify ";
export const JUNE_SWEEP_TITLE = "Wired quiz: June sweep (prices + ESA) before the July 1 retest emails";
const OWNER = "Claude";

export function reverifyTitle(name: string, publisher: string | null): string {
  return `${REVERIFY_PREFIX}${name}${publisher ? ` (${publisher})` : ""}`;
}
/** The instant 6 calendar months before `now`. */
export function staleCutoff(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - STALE_MONTHS);
  return d;
}

interface Cur { id: string; name: string; publisher: string | null; last_verified_at: string | null }
interface Punch { id: string; title: string; status: string }

export async function syncStaleness(db: Db, now: Date = new Date(), dryRun = false): Promise<Record<string, number | boolean>> {
  const cutoff = staleCutoff(now).getTime();
  const approved = (await pg<Cur[]>(db, "wired_curricula?approved=eq.true&select=id,name,publisher,last_verified_at")) ?? [];
  const staleTitles = new Set(approved
    .filter((c) => !c.last_verified_at || Date.parse(c.last_verified_at) < cutoff)
    .map((c) => reverifyTitle(c.name, c.publisher)));
  const open = ((await pg<Punch[]>(db,
    `founder_punch_list?status=in.(open,deferred)&title=like.${encodeURIComponent("Wired quiz:*")}&select=id,title,status`)) ?? [])
    .filter((p) => p.title.startsWith(REVERIFY_PREFIX) || p.title.startsWith("Wired quiz: June sweep"));
  const openTitles = new Set(open.map((p) => p.title));

  const toAdd = [...staleTitles].filter((t) => !openTitles.has(t));
  const toClose = open.filter((p) => p.title.startsWith(REVERIFY_PREFIX) && !staleTitles.has(p.title));
  const june = centralDay(now).slice(5) === "06-01" && !openTitles.has(JUNE_SWEEP_TITLE);

  if (!dryRun) {
    const rows = toAdd.map((title) => ({
      title, owner: OWNER, status: "open",
      detail: "Re-check its price, grades, link and ESA eligibility on the publisher's own pages, then update it on the founder Wired page (that sets the verified date and closes this row).",
    }));
    if (june) rows.push({ title: JUNE_SWEEP_TITLE, owner: OWNER, status: "open", detail: "Before the July 1 retest emails: re-check every approved curriculum's price and every state's ESA eligibility." });
    for (const r of rows) {
      // One at a time: a row another run just made hits the partial unique index (409) and is skipped.
      try {
        await pg(db, "founder_punch_list", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(r) });
      } catch (err) {
        console.error(`wired staleness: could not add "${r.title}":`, err instanceof Error ? err.message : String(err));
      }
    }
    for (const p of toClose) {
      await pg(db, `founder_punch_list?id=eq.${p.id}&status=in.(open,deferred)`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "done", completed_at: now.toISOString() }),
      });
    }
  }
  return { approved: approved.length, stale: staleTitles.size, added: dryRun ? 0 : toAdd.length, would_add: toAdd.length, closed: dryRun ? 0 : toClose.length, would_close: toClose.length, june_sweep: june };
}
