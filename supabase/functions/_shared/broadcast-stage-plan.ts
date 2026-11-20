// _shared/broadcast-stage-plan.ts
//
// Pure rules for broadcast-stage (founder decision 2026-10-14: list emails move to Resend
// Broadcasts from Fri Oct 30). Kept here, apart from the function, so CI's Deno test run
// covers them. Imported ONLY by broadcast-stage.

/** Audience names public.broadcast_audience() knows. Anything else returns nobody there. */
export const BROADCAST_AUDIENCES = [
  'catchup_used_sprouts',
  'catchup_used_seedlings',
  'catchup_used_both',
  'catchup_unused',
  'catchup_quiet',
  'weekly',
  'weekly_skip_sprouts_owners',
  'weekly_skip_seedlings_owners',
  // The whole homeschool list, buyers and kit families included (Nov 20 Thanksgiving, Dec 25).
  'everyone',
  // Plants of the Nativity (Advent 2026): opt-ins only, from public.seasonal_optins.
  'advent_2026',
  // Grade 6-12 waitlists (2026-11-20): from public.band_waitlist.
  'waitlist_cultivators',
  'waitlist_practitioners',
  'waitlist_upper_bands',
] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

export function isBroadcastAudience(v: unknown): v is BroadcastAudience {
  return typeof v === 'string' && (BROADCAST_AUDIENCES as readonly string[]).includes(v);
}

// Every segment this function writes is named "Broadcast: ...", so it can never add to or
// remove from a segment some other code owns (contact-properties-sync keeps "Sprouts
// families", "Buyers" and the rest in step with Postgres).
export const BROADCAST_SEGMENT_PREFIX = 'Broadcast: ';
export const PROOF_SEGMENT = 'Founder proof';

export function isBroadcastSegmentName(v: unknown): v is string {
  return typeof v === 'string' &&
    v.startsWith(BROADCAST_SEGMENT_PREFIX) &&
    /^[A-Za-z0-9 ,.&()'/-]{3,80}$/.test(v.slice(BROADCAST_SEGMENT_PREFIX.length));
}

export type StageStatus = 'added' | 'created' | 'absent' | 'failed';
export interface StageLogRow {
  email: string;
  status: StageStatus;
}

export interface StagePlan {
  /** In the audience, not yet in the segment (never tried, or failed last time). */
  toAdd: string[];
  /** In the segment, no longer in the audience (opted out, bought, became a kit family...). */
  toRemove: string[];
  /** Logged but never in the segment (absent / failed) and no longer in the audience: drop the log row only. */
  toForget: string[];
  /** Audience members already settled (in the segment, or absent from Resend). */
  settled: number;
}

const IN_SEGMENT: ReadonlySet<StageStatus> = new Set(['added', 'created']);

/** What one stage pass must do so the segment holds exactly the audience. Sorted, deterministic. */
export function planStage(audience: readonly string[], log: readonly StageLogRow[]): StagePlan {
  const want = new Set(audience.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const logged = new Map<string, StageStatus>();
  for (const r of log) logged.set(r.email.trim().toLowerCase(), r.status);

  const toAdd: string[] = [];
  let settled = 0;
  for (const e of want) {
    const s = logged.get(e);
    if (s && s !== 'failed') settled++;
    else toAdd.push(e);
  }
  const toRemove: string[] = [];
  const toForget: string[] = [];
  for (const [e, s] of logged) {
    if (want.has(e)) continue;
    if (IN_SEGMENT.has(s)) toRemove.push(e);
    else toForget.push(e);
  }
  return { toAdd: toAdd.sort(), toRemove: toRemove.sort(), toForget: toForget.sort(), settled };
}

export const RESEND_UNSUBSCRIBE_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}';
export const MAX_BROADCAST_HTML_BYTES = 400_000;

/**
 * Refuse a Broadcast body that would go out wrong. Returns the problem, or null when it is fine.
 * Every list email carries Resend's own unsubscribe link (so an opt-out reaches Resend AND,
 * through resend-webhook, Postgres), the company's postal line, and no em dashes.
 */
export function checkBroadcastHtml(html: unknown): string | null {
  if (typeof html !== 'string' || !html.trim()) return 'html required';
  if (new TextEncoder().encode(html).length > MAX_BROADCAST_HTML_BYTES) {
    return `html larger than ${MAX_BROADCAST_HTML_BYTES} bytes`;
  }
  if (!html.includes(RESEND_UNSUBSCRIBE_PLACEHOLDER)) return `html must contain ${RESEND_UNSUBSCRIBE_PLACEHOLDER}`;
  if (html.includes('{{UNSUB_URL}}')) return 'html still holds the transactional {{UNSUB_URL}} placeholder';
  if (html.includes('${')) return 'html holds an unrendered ${...} template';
  if (!html.includes('Rooted in Faith Ventures LLC')) return 'html is missing the postal footer';
  if (/—|&mdash;|&#8212;/i.test(html)) return 'html contains an em dash';
  return null;
}

/** A schedule time must leave a window to cancel and cannot be far off. Returns ISO or an error. */
export function checkScheduledAt(v: unknown, now: number): { iso: string } | { error: string } {
  if (typeof v !== 'string' || !v.trim()) return { error: 'scheduled_at required (ISO 8601)' };
  const t = Date.parse(v);
  if (Number.isNaN(t)) return { error: 'scheduled_at must be ISO 8601' };
  if (t < now + 15 * 60 * 1000) return { error: 'scheduled_at must be at least 15 minutes from now' };
  if (t > now + 31 * 24 * 60 * 60 * 1000) return { error: 'scheduled_at must be within 31 days' };
  return { iso: new Date(t).toISOString() };
}

// ── Automatic refresh (founder decision 2026-10-14: "schedule ahead, refresh automatically")
// A Resend segment is a static snapshot, so a Broadcast scheduled days ahead would go to the
// list as it stood when it was staged. An hourly cron (api/cron/refresh-broadcasts) re-stages
// the segment of every Broadcast scheduled to send within REFRESH_WINDOW_MS, at most once per
// REFRESH_EVERY_MS, so the last refresh lands a few hours before the send.
export const REFRESH_WINDOW_MS = 26 * 60 * 60 * 1000;
export const REFRESH_EVERY_MS = 6 * 60 * 60 * 1000;

/** Resend timestamps come as ISO or as "YYYY-MM-DD HH:MM:SS(.fff)+00". Returns ms or NaN. */
export function parseResendTime(v: unknown): number {
  if (typeof v !== 'string' || !v.trim()) return NaN;
  let s = v.trim().replace(' ', 'T');
  if (/[+-]\d{2}$/.test(s)) s += ':00';
  return Date.parse(s);
}

export interface BroadcastTiming {
  id: string;
  status?: string | null;
  scheduled_at?: string | null;
}

/** Scheduled Broadcasts whose send time is still ahead and inside the window. */
export function dueForRefresh<T extends BroadcastTiming>(list: readonly T[], nowMs: number, windowMs = REFRESH_WINDOW_MS): T[] {
  return list.filter((b) => {
    if (b.status !== 'scheduled') return false;
    const at = parseResendTime(b.scheduled_at);
    return Number.isFinite(at) && at > nowMs && at - nowMs <= windowMs;
  });
}

// 2026-11-16 (Lane 2 area 7 B1, founder tap "Yes, build + ship both"): with refreshes every
// 6 hours the last one used to land 2-8 hours before the send (Nov 13: 5 hours). Inside the
// last FINAL_REFRESH_MS before the send, a list that was not refreshed inside that window is
// refreshed once more, so the hourly :05 run lands its last refresh within the hour before a
// :00 send.
export const FINAL_REFRESH_MS = 90 * 60 * 1000;

/**
 * A segment needs a refresh when it was never refreshed, or not within the last `everyMs`, or
 * (given the send time) the send is inside the final window and the last refresh came before
 * that window opened.
 */
export function needsRefresh(
  lastRefreshedAt: string | null | undefined,
  nowMs: number,
  everyMs = REFRESH_EVERY_MS,
  sendAtMs?: number,
): boolean {
  const last = parseResendTime(lastRefreshedAt ?? '');
  if (!Number.isFinite(last) || nowMs - last >= everyMs) return true;
  if (sendAtMs !== undefined && Number.isFinite(sendAtMs)) {
    const toSend = sendAtMs - nowMs;
    if (toSend > 0 && toSend <= FINAL_REFRESH_MS && sendAtMs - last > FINAL_REFRESH_MS) return true;
  }
  return false;
}

// ── Opt-outs reach Resend every hour (2026-11-16, area 7 B1) ───────────────────────────────
// A Broadcast skips a contact whose own Resend `unsubscribed` flag is true, whatever its
// segment holds. Our unsubscribe link writes only Postgres, and the nightly
// sync-contact-properties run pushed the flag once a day, so a family who left on a Friday
// afternoon still got that evening's email. refresh_due now pushes every opt-out Resend has
// not been told about at the start of each hourly run.
export const OPTOUT_PUSH_PER_RUN = 25;

/**
 * Opt-outs not yet settled in Resend: global (waitlist_signups.unsubscribed_at) plus
 * homeschool-list (email_list_unsubscribes), lowercased, @example.test dropped, minus every
 * address already logged ok or absent in resend_unsubscribe_sync. Sorted, deterministic.
 * Same rule as contact-properties-sync's nightly pass, which keeps running.
 */
export function optOutsToPush(
  globalEmails: readonly string[],
  listEmails: readonly string[],
  settledEmails: readonly string[],
): string[] {
  const settled = new Set(settledEmails.map((e) => e.trim().toLowerCase()));
  const out = new Set<string>();
  for (const raw of [...globalEmails, ...listEmails]) {
    const e = String(raw ?? '').trim().toLowerCase();
    if (!e || e.endsWith('@example.test') || settled.has(e)) continue;
    out.add(e);
  }
  return [...out].sort();
}

/** How a Resend PATCH unsubscribed:true answer is logged. 404 and 422 mean Resend can never mail it. */
export function optOutPushOutcome(status: number): 'ok' | 'absent' | 'failed' {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 404 || status === 422) return 'absent';
  return 'failed';
}

// ── Founder alert when the refresh breaks (2026-11-16, area 7 B2) ───────────────────────────
// A refresh that could not run used to return 200 and the cron logged "ok". Now refresh_due
// collects every problem, answers 500, and emails the founder. A refresh problem only alerts
// once the Broadcast is inside ALERT_WITHIN_MS of its send (earlier blips are retried every
// hour and usually heal); a missing audience and an unreadable Broadcast list alert at once.
// At most one alert per ALERT_BUCKET_HOURS, through a Resend Idempotency-Key.
export const ALERT_WITHIN_MS = 8 * 60 * 60 * 1000;
export const ALERT_BUCKET_HOURS = 6;

/** True when a refresh problem for a Broadcast sending at `sendAtMs` should reach the founder now. */
export function refreshProblemAlerts(sendAtMs: number, nowMs: number, withinMs = ALERT_WITHIN_MS): boolean {
  return Number.isFinite(sendAtMs) && sendAtMs - nowMs <= withinMs;
}

/** One key per UTC day and 6-hour block, so Resend sends at most one alert per block. */
export function refreshAlertKey(nowMs: number): string {
  const d = new Date(nowMs);
  const block = Math.floor(d.getUTCHours() / ALERT_BUCKET_HOURS);
  return `broadcast-stage/refresh-alert/${d.toISOString().slice(0, 10)}/${block}`;
}

/** Plain-text alert body. No em dashes (copy rule). */
export function refreshAlertText(problems: readonly string[]): string {
  return [
    'The hourly refresh of the Friday list emails hit a problem, so a list email may go out to a',
    'list that is not up to date (a family who just unsubscribed could still get it).',
    '',
    ...problems.map((p) => `- ${p}`),
    '',
    'It tries again every hour, and this alert repeats at most once every 6 hours while the',
    'problem lasts. To look into it, tell Claude: "check the Broadcast refresh".',
  ].join('\n');
}
