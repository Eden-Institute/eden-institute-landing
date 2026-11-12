// supabase/functions/_shared/signup-safety.ts
//
// Free-week sign-up hardening, added 2026-11-12 (Lane 2 deep audit, area 5
// findings F1, F2, F4, F6; founder go 2026-11-12 "Yes, build + ship all").
//
// F1. A welcome email Resend refused (429 in a sign-up burst, a 5xx, a 403/422)
//     used to be counted as sent: sendEmail logged the refusal and returned
//     normally, so the family was told "Week 1 is on its way" and nobody knew.
//     sendWelcomeWithRetry returns what really happened, tries a 429 / 5xx /
//     network failure once more, and reuses one Idempotency-Key for both tries so
//     a first try that was accepted but whose reply was lost is not sent twice.
// F4. The sign-up row insert was a single fetch: a gateway 504 lost the row with
//     no retry and no alert. insertOrFetchWithRetry tries a 502/503/504 or a
//     network failure once more. Repeating the INSERT is safe here because
//     waitlist_signups has UNIQUE (email, entry_funnel): if the first try did
//     commit, the repeat answers 409 and the existing row is looked up instead.
// F6. nurture-emails' "has this person opted out / do they already own it"
//     checks treated an unreadable answer (a PostgREST error object) as "no", so
//     an outage could email someone who had unsubscribed. rowsOrThrow makes such
//     a check fail closed: the drain's per-row catch keeps the row pending and
//     retries it, the same as a failed send.

/** What a welcome send really did. `status` is null when Resend never answered. */
export interface WelcomeSendResult {
  ok: boolean;
  status: number | null;
  /** Resend email id when accepted. */
  id?: string;
  /** Short reason when not accepted (Resend's reply or the network error). */
  error?: string;
  /** How many POSTs were made (1 or 2). */
  attempts: number;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const WELCOME_RETRY_DELAY_MS = 1500;
export const WELCOME_TIMEOUT_MS = 10_000;

/** A refusal worth one more try: rate limit, server error, or no answer at all. */
export function isRetryableWelcomeStatus(status: number | null): boolean {
  return status === null || status === 429 || status >= 500;
}

/**
 * POST one email to Resend, with one retry for a 429 / 5xx / network failure.
 *
 * The same Idempotency-Key goes on both tries (the caller makes a fresh one per
 * sign-up request, so a deliberate repeat sign-up still gets its own welcome).
 * Resend answers a repeat of an accepted key with the original reply, so a first
 * try that went through but timed out is not delivered twice. A 409 on the second
 * try means Resend already holds a request under this key (accepted, or still
 * being sent), so it is reported as accepted.
 *
 * Never throws.
 */
export async function sendWelcomeWithRetry(
  payload: Record<string, unknown>,
  opts: {
    apiKey: string;
    idempotencyKey: string;
    fetchImpl?: FetchLike;
    sleep?: (ms: number) => Promise<void>;
    delayMs?: number;
    timeoutMs?: number;
  },
): Promise<WelcomeSendResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delayMs = opts.delayMs ?? WELCOME_RETRY_DELAY_MS;
  const timeoutMs = opts.timeoutMs ?? WELCOME_TIMEOUT_MS;
  let last: WelcomeSendResult = { ok: false, status: null, error: 'not attempted', attempts: 0 };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': opts.idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text().catch(() => '');
      if (res.ok) {
        let id: string | undefined;
        try {
          const parsed = JSON.parse(text) as { id?: unknown };
          id = typeof parsed?.id === 'string' ? parsed.id : undefined;
        } catch {
          id = undefined;
        }
        return { ok: true, status: res.status, id, attempts: attempt };
      }
      if (res.status === 409 && attempt > 1) {
        // Resend already holds a request under this key from the first try.
        return { ok: true, status: res.status, error: text.slice(0, 300), attempts: attempt };
      }
      last = { ok: false, status: res.status, error: text.slice(0, 300), attempts: attempt };
      if (!isRetryableWelcomeStatus(res.status)) return last;
    } catch (err) {
      last = { ok: false, status: null, error: (err instanceof Error ? err.message : String(err)).slice(0, 300), attempts: attempt };
    }
    if (attempt < 2) await sleep(delayMs);
  }
  return last;
}

export const SIGNUP_RETRY_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);
export const SIGNUP_RETRY_DELAY_MS = 1000;

/**
 * Insert a sign-up row, or find the existing one, with one retry.
 *
 *   insert  POST the row (return=representation). 2xx with a row = done.
 *   lookup  GET the existing row by its unique (email, entry_funnel), used on 409.
 *
 * A 502/503/504 or a network failure on either step is tried once more. Returns
 * the row, or null after the second failure (the caller raises the alert).
 * Never throws.
 */
export async function insertOrFetchWithRetry(
  insert: () => Promise<Response>,
  lookup: () => Promise<Response>,
  opts: { sleep?: (ms: number) => Promise<void>; delayMs?: number; log?: (msg: string) => void } = {},
): Promise<{ id: string; resend_contact_id: string | null } | null> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delayMs = opts.delayMs ?? SIGNUP_RETRY_DELAY_MS;
  const log = opts.log ?? ((m: string) => console.error(m));

  const firstRow = async (res: Response): Promise<{ id: string; resend_contact_id: string | null } | null> => {
    try {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && typeof data[0]?.id === 'string') {
        return { id: data[0].id, resend_contact_id: data[0].resend_contact_id ?? null };
      }
    } catch {
      // unreadable body: treated as no row
    }
    return null;
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    let retryable = false;
    try {
      const res = await insert();
      if (res.ok) {
        const row = await firstRow(res);
        if (row) return row;
        log(`waitlist_signups insert answered ${res.status} with no row (try ${attempt})`);
      } else if (res.status === 409) {
        await res.body?.cancel().catch(() => {});
        try {
          const found = await lookup();
          if (found.ok) {
            const row = await firstRow(found);
            if (row) return row;
            log(`waitlist_signups lookup after 409 found no row (try ${attempt})`);
          } else {
            const t = await found.text().catch(() => '');
            log(`waitlist_signups lookup after 409 failed: ${found.status} ${t.slice(0, 200)} (try ${attempt})`);
            retryable = SIGNUP_RETRY_STATUSES.has(found.status);
          }
        } catch (err) {
          log(`waitlist_signups lookup after 409 threw: ${err instanceof Error ? err.message : String(err)} (try ${attempt})`);
          retryable = true;
        }
      } else {
        const t = await res.text().catch(() => '');
        log(`waitlist_signups upsert failed: ${res.status} ${t.slice(0, 200)} (try ${attempt})`);
        retryable = SIGNUP_RETRY_STATUSES.has(res.status);
      }
    } catch (err) {
      log(`waitlist_signups insert threw: ${err instanceof Error ? err.message : String(err)} (try ${attempt})`);
      retryable = true;
    }
    if (!retryable) break;
    if (attempt < 2) await sleep(delayMs);
  }
  return null;
}

/**
 * The rows of a PostgREST read, or a throw when the answer is not a list (an
 * error object). For checks that must fail CLOSED: a caller that cannot tell
 * whether someone opted out must not email them.
 */
// deno-lint-ignore no-explicit-any
export function rowsOrThrow(result: unknown, what: string): any[] {
  if (Array.isArray(result)) return result;
  let shown = '';
  try {
    shown = JSON.stringify(result) ?? String(result);
  } catch {
    shown = String(result);
  }
  throw new Error(`${what}: could not check (${shown.slice(0, 200)})`);
}
