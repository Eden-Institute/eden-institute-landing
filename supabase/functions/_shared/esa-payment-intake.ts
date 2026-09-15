// ESA payment intake guards, used by the esa-payment edge function. Added 2026-09-16 (founder
// decision 2026-09-15). Pure (no network), tested in esa-payment-intake.test.ts.
//
//   normaliseReceivedAt  scripts/esa_payment_intake.py sends Gmail's internalDate as Python
//                        isoformat() ("2026-09-15T14:03:22.123000+00:00"). Anything that is not an
//                        ISO date, is in the future past a small clock skew, or is absurdly old is
//                        replaced with now and the reason is kept as a note on the esa_payments row.
//   intakeFailureRow     when intake throws, the raw notice is kept in esa_payment_intake_failures
//                        and the founder is alerted, once per Gmail message per day (the script
//                        re-sends a failed notice on every run).

/** How far in the future a received_at may be (clock skew between the founder's PC and the server). */
export const RECEIVED_AT_MAX_SKEW_MS = 10 * 60 * 1000;
/** Older than this is treated as a bad value, not a real notice. */
export const RECEIVED_AT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2}))?$/;

export function normaliseReceivedAt(raw: unknown, now: Date = new Date()): { iso: string; note: string | null } {
  const fallback = (why: string) => ({ iso: now.toISOString(), note: `received_at ${why}; recorded the intake time instead` });
  if (raw === undefined || raw === null || raw === "") return fallback("was missing");
  if (typeof raw !== "string") return fallback("was not text");
  const s = raw.trim();
  const shown = JSON.stringify(s.slice(0, 40));
  if (!ISO_RE.test(s)) return fallback(`${shown} is not an ISO date`);
  // Date.parse rolls impossible dates over (Feb 31 becomes Mar 3), so check the calendar first.
  const [y, mo, d] = s.slice(0, 10).split("-").map(Number);
  const hh = s.length > 10 ? Number(s.slice(11, 13)) : 0;
  const mi = s.length > 10 ? Number(s.slice(14, 16)) : 0;
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate() || hh > 23 || mi > 59) {
    return fallback(`${shown} is not a real date`);
  }
  // Deno's Date parses up to millisecond precision; trim longer fractions so Python's microseconds parse.
  const ms = Date.parse(s.replace(/(\.\d{3})\d+/, "$1"));
  if (Number.isNaN(ms)) return fallback(`${shown} is not a real date`);
  if (ms > now.getTime() + RECEIVED_AT_MAX_SKEW_MS) return fallback(`${shown} is in the future`);
  if (ms < now.getTime() - RECEIVED_AT_MAX_AGE_MS) return fallback(`${shown} is more than a year old`);
  return { iso: new Date(ms).toISOString(), note: null };
}

/** The row kept when intake throws. Every field is length-capped. */
export function intakeFailureRow(b: Record<string, unknown>, error: unknown): Record<string, unknown> {
  const str = (v: unknown, max: number) => (v === undefined || v === null ? null : String(v).slice(0, max));
  return {
    gmail_msg_id: str(b.gmail_msg_id, 200),
    received_at_raw: str(b.received_at, 100),
    from_addr: str(b.from, 200),
    subject: str(b.subject, 300),
    excerpt: str(b.body, 4000),
    error: (error instanceof Error ? error.message : String(error)).slice(0, 1000) || "unknown error",
  };
}

/** Alert the founder only for the first failure of a message in the look-back window. */
export function shouldAlertIntakeFailure(earlierFailuresForMessage: number | null): boolean {
  return earlierFailuresForMessage === null || earlierFailuresForMessage === 0;
}
