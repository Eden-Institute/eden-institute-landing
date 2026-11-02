// supabase/functions/notify-founder-digest/system-health.ts
//
// The digest's System health block (2026-10-30, founder goal for the monthly
// System cleanup: "nothing fails silently").
//
// WHY. Each line here is a check the monthly cleanup runs by hand. Run every morning
// instead, a failure reaches the founder the next day rather than at month end. The
// first cleanup found two failures nobody had seen:
//   - 74 queue emails that failed between May and September and were never closed.
//     The Email rails table only counts failures from the last 24 hours, so after
//     their first day they showed nowhere.
//   - GA4_MP_API_SECRET was never set, so stripe-webhook marks every sale
//     skipped_no_secret and GA4 records no purchases at all (PR #679 moved purchase
//     reporting to the server; the browser no longer sends it).
//
// index.ts reads the counts (fetchSystemHealthInput); this file only decides what
// they mean and renders them, so deno test runs it with no network.
//
// A count that could not be read is null and shows as "could not be checked", never
// as a pass: a check that cannot see is not a healthy check.

export interface SystemHealthInput {
  /** recap_runs.status for the digest day; null when no row exists. */
  recapStatus: string | null;
  /** True when the recap_runs read itself failed. */
  recapUnread?: boolean;
  /** Newest weekly_trends_runs.run_date with status 'sent' (YYYY-MM-DD); null when none or unread. */
  lastTrendsSent: string | null;
  trendsUnread?: boolean;
  /** digest_runs rows left 'failed' in the last 30 days. */
  digestFailed30d: number | null;
  /** status='failed' rows per queue, any age. */
  failedByQueue: Record<string, number | null>;
  /** Oldest scheduled_for among the failed rows (ISO); null when none or unread. */
  oldestFailed: string | null;
  /** status='pending' rows more than 24 hours past scheduled_for, per queue. */
  stuckByQueue: Record<string, number | null>;
  /** stripe_events from the last 30 days with an error, or not processed after an hour. */
  stripeProblems: number | null;
  /** lulu_jobs neither submitted nor cancelled an hour after they were created. */
  luluProblems: number | null;
  /** starter_deliveries not sent an hour after they were created. */
  starterProblems: number | null;
  /** Real payments recorded since the GA4 server path went live, by ga4_status ('none' = never attempted). */
  ga4ByStatus: Record<string, number> | null;
  /** Whether GA4_MP_API_SECRET is set. Edge Function secrets are project-wide, so the
   *  digest sees the same value stripe-webhook does, and catches a missing key before
   *  the first sale is lost rather than after. */
  ga4SecretSet: boolean;
}

export interface HealthCheck {
  key: string;
  /** true = pass, false = problem, null = could not be checked. */
  ok: boolean | null;
  detail: string;
}

/** Queue table name -> the plain name the founder knows it by. */
export const QUEUE_LABEL: Record<string, string> = {
  nurture_email_queue: 'quiz emails',
  magnet_email_queue: 'free-week emails',
  launch_email_queue: 'launch emails',
  buyer_email_queue: 'buyer emails',
  followup_email_queue: 'follow-up emails',
  founding_family_queue: 'Founding Family emails',
};

/** ga4_status values that mean GA4 did NOT get a sale it should have. Every other
 *  skip is deliberate and documented in _shared/ga4-mp.ts (test mode, internal,
 *  declined cookies, a receipt its checkout row reports, an unmatched refund). */
const GA4_PROBLEM = new Set(['none', 'failed', 'skipped_no_secret']);
const GA4_PROBLEM_LABEL: Record<string, string> = {
  none: 'never reported',
  failed: 'GA4 refused',
  skipped_no_secret: 'GA4 key missing',
};

function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000);
}

function sumOrNull(m: Record<string, number | null>): number | null {
  let total = 0;
  for (const v of Object.values(m)) {
    if (v === null) return null;
    total += v;
  }
  return total;
}

function perQueue(m: Record<string, number | null>): string {
  return Object.entries(m)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([q, n]) => `${QUEUE_LABEL[q] ?? q} ${n}`)
    .join(', ');
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The checks, in the order the founder reads them. `digestDate` is the Central-time
 *  day the digest covers (yesterday); `todayCt` is today in Central time. */
export function evaluateSystemHealth(input: SystemHealthInput, digestDate: string, todayCt: string): HealthCheck[] {
  const checks: HealthCheck[] = [];

  // Evening recap: the 01:00 UTC run writes one row per Central-time day.
  if (input.recapUnread) {
    checks.push({ key: 'recap', ok: null, detail: 'Evening recap: could not be checked.' });
  } else if (input.recapStatus === 'sent') {
    checks.push({ key: 'recap', ok: true, detail: `Evening recap went out for ${digestDate}.` });
  } else {
    checks.push({ key: 'recap', ok: false, detail: `Evening recap for ${digestDate} did not go out (${input.recapStatus ?? 'no run recorded'}).` });
  }

  // Weekly trends: Fridays. Eight days of slack covers a Friday digest that runs
  // a few seconds before that morning's trends email.
  if (input.trendsUnread) {
    checks.push({ key: 'trends', ok: null, detail: 'Weekly trends email: could not be checked.' });
  } else if (input.lastTrendsSent && daysBetween(input.lastTrendsSent, todayCt) <= 8) {
    checks.push({ key: 'trends', ok: true, detail: `Weekly trends email last went out ${input.lastTrendsSent}.` });
  } else {
    checks.push({ key: 'trends', ok: false, detail: `Weekly trends email has not gone out since ${input.lastTrendsSent ?? 'it began'}.` });
  }

  if (input.digestFailed30d === null) {
    checks.push({ key: 'digest', ok: null, detail: 'Earlier daily digests: could not be checked.' });
  } else if (input.digestFailed30d === 0) {
    checks.push({ key: 'digest', ok: true, detail: 'No daily digest failed in the last 30 days.' });
  } else {
    checks.push({ key: 'digest', ok: false, detail: `${plural(input.digestFailed30d, 'daily digest')} in the last 30 days failed and never went out.` });
  }

  const failed = sumOrNull(input.failedByQueue);
  if (failed === null) {
    checks.push({ key: 'failed_emails', ok: null, detail: 'Failed emails: could not be checked.' });
  } else if (failed === 0) {
    checks.push({ key: 'failed_emails', ok: true, detail: 'No automated email is sitting failed.' });
  } else {
    const oldest = input.oldestFailed ? `, oldest ${input.oldestFailed.slice(0, 10)}` : '';
    checks.push({
      key: 'failed_emails',
      ok: false,
      detail: `${plural(failed, 'automated email')} failed and ${failed === 1 ? 'was' : 'were'} never closed (${perQueue(input.failedByQueue)}${oldest}). Ask Claude to review them: retry or close each one.`,
    });
  }

  const stuck = sumOrNull(input.stuckByQueue);
  if (stuck === null) {
    checks.push({ key: 'stuck_emails', ok: null, detail: 'Waiting emails: could not be checked.' });
  } else if (stuck === 0) {
    checks.push({ key: 'stuck_emails', ok: true, detail: 'No email is waiting more than a day past its send time.' });
  } else {
    checks.push({ key: 'stuck_emails', ok: false, detail: `${plural(stuck, 'email')} ${stuck === 1 ? 'is' : 'are'} more than a day past ${stuck === 1 ? 'its' : 'their'} send time (${perQueue(input.stuckByQueue)}).` });
  }

  const money: Array<[string, number | null, string, string]> = [
    ['stripe', input.stripeProblems, 'Stripe payment notices', 'Stripe payment notice'],
    ['lulu', input.luluProblems, 'Lulu print orders', 'Lulu print order'],
    ['starter', input.starterProblems, 'Starter Unit downloads', 'Starter Unit download'],
  ];
  for (const [key, n, many, one] of money) {
    if (n === null) checks.push({ key, ok: null, detail: `${many}: could not be checked.` });
    else if (n === 0) checks.push({ key, ok: true, detail: `${many}: nothing failed or stuck.` });
    else checks.push({ key, ok: false, detail: `${plural(n, one, many.toLowerCase())} failed or stuck. A customer may be waiting.` });
  }

  if (!input.ga4SecretSet) {
    checks.push({
      key: 'ga4',
      ok: false,
      detail: 'The Google Analytics sales key (GA4_MP_API_SECRET) is not set, so no sale reaches Google Analytics. Ask Claude for the steps to create it.',
    });
  } else if (input.ga4ByStatus === null) {
    checks.push({ key: 'ga4', ok: null, detail: 'Sales reported to Google Analytics: could not be checked.' });
  } else {
    const missing = Object.entries(input.ga4ByStatus).filter(([s, n]) => GA4_PROBLEM.has(s) && n > 0);
    const total = missing.reduce((a, [, n]) => a + n, 0);
    if (total === 0) {
      checks.push({ key: 'ga4', ok: true, detail: 'Every sale in the last 7 days reached Google Analytics (or was skipped on purpose).' });
    } else {
      const why = missing.map(([s, n]) => `${GA4_PROBLEM_LABEL[s] ?? s} ${n}`).join(', ');
      checks.push({ key: 'ga4', ok: false, detail: `${plural(total, 'sale')} in the last 7 days did not reach Google Analytics (${why}).` });
    }
  }

  return checks;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** One block for the email. All passing: a single green line. Otherwise the problems
 *  first, in red, then a short count of what passed. */
export function systemHealthHtml(checks: HealthCheck[]): string {
  if (checks.length === 0) return '';
  const problems = checks.filter((c) => c.ok !== true);
  const passed = checks.length - problems.length;
  const label = `<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:16px 0 8px 0;">System health</p>`;
  if (problems.length === 0) {
    return `${label}
<p style="font-family:Georgia,serif;font-size:13px;color:#1C3A2E;margin:0 0 8px 0;">All ${checks.length} checks passed: scheduled emails, failed and waiting emails, Stripe, Lulu, Starter downloads, and sales reaching Google Analytics.</p>`;
  }
  const items = problems.map((c) =>
    `<li style="margin:0 0 6px 0;">${c.ok === null ? '<strong>Could not check.</strong> ' : ''}${esc(c.detail)}</li>`
  ).join('');
  return `${label}
<ul style="font-family:Georgia,serif;font-size:13px;color:#8B2E2E;margin:0 0 6px 0;padding-left:18px;">${items}</ul>
<p style="font-family:Georgia,serif;font-size:12px;color:#6B6560;margin:0 0 8px 0;">${passed} of ${checks.length} checks passed.</p>`;
}

export function systemHealthTextLines(checks: HealthCheck[]): string[] {
  if (checks.length === 0) return [];
  const problems = checks.filter((c) => c.ok !== true);
  if (problems.length === 0) return ['System health: all ' + checks.length + ' checks passed.'];
  return [
    `System health: ${problems.length} problem${problems.length === 1 ? '' : 's'} (${checks.length - problems.length} of ${checks.length} passed)`,
    ...problems.map((c) => `  ${c.ok === null ? 'COULD NOT CHECK: ' : 'PROBLEM: '}${c.detail}`),
  ];
}

/** True when any check failed or could not run: the digest subject says so. */
export function hasHealthProblem(checks: HealthCheck[]): boolean {
  return checks.some((c) => c.ok !== true);
}
