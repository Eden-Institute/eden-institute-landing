// supabase/functions/_shared/send-backoff.ts
//
// What a queued email does after a failed send (founder decision 2026-09-15).
//
// Before: every failure, whatever the cause, spent one of 3 retries on the next
// 15-minute cron tick, so a Resend rate limit or daily-quota outage marked due
// emails failed forever after about 45 minutes. After:
//
//   TRANSIENT (429, quota or rate limit, 5xx, 408, network error, a thrown
//   error, and 401/403 which mean our key or domain needs fixing, not that the
//   address is bad): the row stays pending with next_attempt_at pushed out on an
//   exponential schedule (5 min, 10, 20, 40, 80, then every 2 h), for up to 24
//   hours from first_failed_at. The last attempt is pulled in to land exactly at
//   the 24-hour mark. A failure at or after that mark marks the row failed and
//   stamps gave_up_at; the drain then emails the founder one summary for the
//   rows that gave up (founder_alerted_at makes that once per row, and at most
//   one summary goes out per hour).
//
//   PERMANENT (400 validation, 422, invalid address, and any other 4xx): failed
//   at once, exactly as before. Retrying cannot change the answer.
//
// This module is pure: no network, no clock of its own. The drain supplies `now`.

export const BACKOFF_BASE_MS = 5 * 60 * 1000;
export const BACKOFF_MAX_MS = 2 * 60 * 60 * 1000;
export const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type FailureKind = 'transient' | 'permanent';

export interface SendFailure {
  /** HTTP status from Resend, or null/undefined when no response arrived (network, timeout, throw). */
  status?: number | null;
  /** Resend's error `name` (e.g. 'daily_quota_exceeded', 'validation_error'), when present. */
  name?: string | null;
  message?: string | null;
}

const TRANSIENT_TEXT = /quota|rate[ _-]?limit|too many requests|timed? ?out|temporar|unavailable|overloaded/i;

export function classifySendFailure(f: SendFailure): FailureKind {
  const status = f.status;
  if (status === undefined || status === null || !Number.isFinite(status)) return 'transient';
  if (status === 429 || status === 408 || status >= 500) return 'transient';
  const text = `${f.name ?? ''} ${f.message ?? ''}`;
  if (TRANSIENT_TEXT.test(text)) return 'transient';
  // 401 / 403: a revoked or restricted API key, or an unverified sending domain.
  // Fixable on our side, and failing the whole list forever would be the worse outcome.
  if (status === 401 || status === 403) return 'transient';
  if (status >= 400 && status < 500) return 'permanent';
  // A 2xx/3xx that still did not produce an accepted email: unexpected, retry.
  return 'transient';
}

/** Delay before retry number `attempt` (1 = the first retry after the first failure). */
export function backoffDelayMs(attempt: number): number {
  const n = Math.max(1, Math.floor(attempt));
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.min(n - 1, 20), BACKOFF_MAX_MS);
}

export interface QueueRowRetryState {
  retry_count?: number | null;
  first_failed_at?: string | null;
}

export type FailurePlan =
  | {
    action: 'retry';
    patch: {
      status: 'pending';
      retry_count: number;
      first_failed_at: string;
      next_attempt_at: string;
      error_message: string;
    };
  }
  | {
    action: 'give_up';
    reason: 'permanent' | 'window_expired';
    patch: {
      status: 'failed';
      retry_count: number;
      first_failed_at: string;
      next_attempt_at: null;
      /** Set only when the 24-hour window ran out: that is what the founder is alerted about. */
      gave_up_at: string | null;
      error_message: string;
    };
  };

/** Decide what a failed send does to its queue row. `updated_at` is left to the caller. */
export function planSendFailure(
  row: QueueRowRetryState,
  failure: SendFailure,
  now: Date,
): FailurePlan {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const retryCount = (row.retry_count ?? 0) + 1;
  const parsedFirst = row.first_failed_at ? Date.parse(row.first_failed_at) : NaN;
  // A first_failed_at in the future (clock skew, bad data) must not extend the window.
  const firstMs = Number.isFinite(parsedFirst) && parsedFirst <= nowMs ? parsedFirst : nowMs;
  const firstIso = new Date(firstMs).toISOString();
  const kind = classifySendFailure(failure);
  const statusPart = failure.status ? `${failure.status} ` : '';
  const detail = `${statusPart}${failure.message ?? failure.name ?? 'send failed'}`.slice(0, 1000);

  if (kind === 'permanent') {
    return {
      action: 'give_up',
      reason: 'permanent',
      patch: {
        status: 'failed',
        retry_count: retryCount,
        first_failed_at: firstIso,
        next_attempt_at: null,
        // A bad address is not an outage: failed at once, as before, with no founder alert.
        gave_up_at: null,
        error_message: `permanent: ${detail}`,
      },
    };
  }

  const deadlineMs = firstMs + RETRY_WINDOW_MS;
  if (nowMs >= deadlineMs) {
    return {
      action: 'give_up',
      reason: 'window_expired',
      patch: {
        status: 'failed',
        retry_count: retryCount,
        first_failed_at: firstIso,
        next_attempt_at: null,
        gave_up_at: nowIso,
        error_message: `gave up after 24h of retries: ${detail}`,
      },
    };
  }

  const nextMs = Math.min(nowMs + backoffDelayMs(retryCount), deadlineMs);
  return {
    action: 'retry',
    patch: {
      status: 'pending',
      retry_count: retryCount,
      first_failed_at: firstIso,
      next_attempt_at: new Date(nextMs).toISOString(),
      error_message: `transient, retrying: ${detail}`,
    },
  };
}

/**
 * PostgREST filter fragment for "not waiting out a backoff". Rows that never
 * failed have next_attempt_at null. Appended to the existing
 * status=eq.pending&scheduled_for=lte.<now> queue query, so rows in a backoff
 * wait are excluded by the database and never take a batch slot from rows that
 * are due.
 */
export function dueFilter(nowIso: string): string {
  return `or=(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(nowIso)})`;
}
