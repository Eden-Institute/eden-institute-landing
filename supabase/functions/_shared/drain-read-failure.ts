// supabase/functions/_shared/drain-read-failure.ts
//
// Audit area 6 NEW-3 (Camila's tap "Yes, build + ship", 2026-11-19). The nurture-emails
// drains used to treat a failed queue read as "nothing due" and report success, so a
// database outage could hold the drip emails for hours with nothing flagged until the
// next morning's digest. Now a drain that cannot read its queue says so
// (`read_failed: true`), the run answers 500, and if a second read a few seconds later
// still fails, the founder gets ONE alert per clock hour. No email is lost either way:
// each waits in its queue and goes out on the first run that can read it.
//
// Pure: the decisions and the alert text, so they are unit tested. The I/O (the second
// read, the Resend call with the hourly Idempotency-Key) lives in nurture-emails.
// Voice rule: no em dashes.

/** Each drain's result, as nurture-emails returns it. Only read_failed matters here. */
export type DrainResults = Record<string, { read_failed?: boolean } | undefined>;

/** Which table each drain reads first: the second-chance probe re-reads it. */
export const DRAIN_TABLES: Record<string, string> = {
  buyer: 'buyer_email_queue',
  founding_family: 'founding_family_queue',
  queue: 'nurture_email_queue',
  followup: 'followup_email_queue',
  magnet: 'magnet_email_queue',
  launch: 'launch_email_queue',
  legacy_email5: 'quiz_completions',
};

/** Plain names for the alert, so it reads like a sentence and not a table list. */
const PLAIN: Record<string, string> = {
  buyer: 'buyer notes after a purchase',
  founding_family: 'Founding Family emails',
  queue: 'quiz emails',
  followup: 'order follow-up emails',
  magnet: 'free-week emails',
  launch: 'Starter series emails',
  legacy_email5: 'the old quiz email 5',
};

/** The drains whose queue read failed this run, in a stable order. */
export function readFailures(results: DrainResults): string[] {
  return Object.keys(results).filter((k) => results[k]?.read_failed === true).sort();
}

/** One alert per UTC clock hour: Resend drops a repeat of the same Idempotency-Key. */
export function readFailureAlertKey(now: Date): string {
  return `nurture-read-failed-${now.toISOString().slice(0, 13)}`;
}

export function readFailureAlert(drains: string[], now: Date): { subject: string; text: string; idempotencyKey: string } {
  const names = drains.map((d) => PLAIN[d] ?? d);
  const list = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return {
    subject: 'The email sender could not read its queue',
    text:
      `The email sender (it runs every 15 minutes) could not read these emails from the database just now, ` +
      `and a second try a few seconds later failed too: ${list}.\n\n` +
      `No email has been lost. Each one waits in its queue and goes out on the first run that can read it. ` +
      `Until then, those emails are late.\n\n` +
      `The usual cause is a Supabase outage or slowdown. Ask Claude to look if this keeps coming.\n\n` +
      `You get at most one of these an hour while it keeps happening.`,
    idempotencyKey: readFailureAlertKey(now),
  };
}
