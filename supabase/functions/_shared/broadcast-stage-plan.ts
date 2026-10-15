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
