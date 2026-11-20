// supabase/functions/_shared/send-day-guard.ts
//
// "Never two Eden nurture emails on one day" (spec section 11, DECIDED 2026-11-17; answer 5).
// Source of truth: public.nurture_send_log (email_lower, sent_on, source, queue_row_id), one row per
// address per Central calendar day, enforced by a unique index on (email_lower, sent_on).
//
// The send function CLAIMS the day right before it calls Resend (an insert that loses to the unique
// index means another email already has today), and RELEASES the claim if the send then fails. Claiming
// first (rather than logging after) means two drains running at the same moment (nurture-emails every
// 15 minutes, wired-pdf every 5) can never both send to one address on one day.
//
// Who is guarded: every nurture-queue send (nurture, magnet, followup, launch, buyer, founding family,
// wired learner drip 2-10 and July). EXEMPT, never held and never logged (answer 5 + 32): wired email 1
// (the results she just asked for), purchase PDFs, observer invites and reminders, teen-ready, updated
// PDFs, delete confirm. Resend Broadcasts (the Friday list email) do not count (DECIDED 2026-11-18).
//
// Fails OPEN: if the log cannot be read or written, the email sends (a spacing rule, unlike an opt-out,
// is never worth losing an email over) and the error is logged.

export const SEND_DAY_TZ = "America/Chicago";
/** Held emails move to the next Central morning at this hour (the house "8 AM Central" send time). */
export const DEFER_HOUR_CT = 8;

/** The Central calendar day of an instant, as YYYY-MM-DD. */
export function centralDay(at: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: SEND_DAY_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** Minutes Central is behind UTC at that instant (300 in summer, 360 in winter). */
function centralOffsetMinutes(at: Date): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: SEND_DAY_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return Math.round((at.getTime() - asUtc) / 60000);
}

/** DEFER_HOUR_CT:00 Central on the Central calendar day `daysAhead` after `now`'s, as an instant (DST-correct). */
export function centralMorning(now: Date, daysAhead: number): Date {
  const [y, m, d] = centralDay(now).split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d + daysAhead, DEFER_HOUR_CT, 0));
  // guess is DEFER_HOUR_CT:00 UTC on that day; shift by Central's offset on that day.
  const off = centralOffsetMinutes(new Date(guess.getTime() + 6 * 3600_000));
  return new Date(guess.getTime() + off * 60000);
}

/** Where a held email goes: the next Central morning. */
export const nextCentralMorning = (now: Date): Date => centralMorning(now, 1);

export interface GuardDb { url: string; key: string; fetchImpl?: typeof fetch }

function headers(db: GuardDb, prefer?: string): Record<string, string> {
  return { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) };
}

export type ClaimResult = "claimed" | "taken" | "error";

/**
 * Claim today's one nurture email for this address. "claimed" = send it; "taken" = another email
 * (a different queue row) already has today, so hold this one until tomorrow; "error" = the log could
 * not be read or written (the caller sends anyway: fail open). A retry of the SAME queue row on the same
 * day finds its own claim and counts as "claimed".
 */
export async function claimSendDay(db: GuardDb, email: string, source: string, queueRowId: string, now: Date = new Date()): Promise<ClaimResult> {
  const f = db.fetchImpl ?? fetch;
  const emailLower = email.trim().toLowerCase();
  const sentOn = centralDay(now);
  try {
    const ins = await f(`${db.url}/rest/v1/nurture_send_log?on_conflict=email_lower,sent_on`, {
      method: "POST",
      headers: headers(db, "return=representation,resolution=ignore-duplicates"),
      body: JSON.stringify([{ email_lower: emailLower, sent_on: sentOn, source, queue_row_id: queueRowId }]),
    });
    if (!ins.ok) throw new Error(`claim insert ${ins.status}: ${(await ins.text().catch(() => "")).slice(0, 200)}`);
    const rows = await ins.json().catch(() => null);
    if (Array.isArray(rows) && rows.length) return "claimed";
    const sel = await f(`${db.url}/rest/v1/nurture_send_log?email_lower=eq.${encodeURIComponent(emailLower)}&sent_on=eq.${sentOn}&select=queue_row_id&limit=1`, { headers: headers(db) });
    if (!sel.ok) throw new Error(`claim read ${sel.status}`);
    const got = await sel.json().catch(() => null) as { queue_row_id: string }[] | null;
    if (!Array.isArray(got)) throw new Error("claim read: not an array");
    if (!got.length) return "error"; // lost the race to a release in between; let it send
    return got[0].queue_row_id === queueRowId ? "claimed" : "taken";
  } catch (err) {
    console.error(`send-day-guard: could not check today's send for a ${source} row (${queueRowId}); sending anyway:`, err instanceof Error ? err.message : String(err));
    return "error";
  }
}

/** Give today back after a send that did not go out (never throws). */
export async function releaseSendDay(db: GuardDb, queueRowId: string, now: Date = new Date()): Promise<void> {
  const f = db.fetchImpl ?? fetch;
  try {
    const res = await f(`${db.url}/rest/v1/nurture_send_log?queue_row_id=eq.${queueRowId}&sent_on=eq.${centralDay(now)}`, {
      method: "DELETE", headers: headers(db, "return=minimal"),
    });
    if (!res.ok) console.error(`send-day-guard: could not release ${queueRowId} (${res.status})`);
  } catch (err) {
    console.error(`send-day-guard: release of ${queueRowId} threw:`, err instanceof Error ? err.message : String(err));
  }
}
