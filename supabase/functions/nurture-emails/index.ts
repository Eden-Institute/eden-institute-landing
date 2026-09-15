// nurture-emails — Lock #48 queue drainer + legacy Email 5 fallback
//
// Caller: Vercel cron at /api/cron/drain-nurture-queue (every 15 min, per vercel.json)
// Auth: Caller sends Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>. verify_jwt = true is pinned
// in supabase/config.toml, and the handler additionally rejects any non-service-role caller
// (isServiceRoleRequest, _shared/require-service-role.ts). The anon key is a valid JWT and
// passes the gateway alone, so the in-code role check is what limits this to the Vercel cron.
//
// Flows handled (Deno.serve sets the run order):
//
//   1. drainNurtureQueue() — Lock #48 consumer side. Pulls public.nurture_email_queue
//      rows where status='pending' AND scheduled_for <= now(). Quiz/constitution
//      drip (positions 2-7). Includes Phase 1 behavioral suppression (don't
//      re-pitch a purchased offer).
//
//   2. drainMagnetQueue() — homeschool (Sprouts/Seedlings) sequence from
//      public.magnet_email_queue. Positions:
//        2 — Week 2 curriculum (band-specific: Chamomile / Tulsi)
//        3 — Week 3 "come along for the ride" Facebook/story (band-agnostic)
//        4 — Week 4 older-kids stopgap → Foundations course (band-agnostic)
//        5 — Week 5 use the Around-the-Table cards (band-agnostic)
//        6 — Week 6 seasonal herb (band-agnostic)
//        7 — Week 7 devotional (band-agnostic)
//      Only position 2 is enqueued (resend-waitlist, since 2026-07-28).
//      Position 3 and the 4-7 chain are DORMANT: nothing enqueues 3, so
//      MAGNET_CHAIN_NEXT never fires. Kept so the tail can be re-enabled by
//      enqueueing 3 again; see migration 20260728234500. Band-agnostic
//      positions (3-7) are de-duplicated so a family in BOTH bands gets each
//      of those once; Week 2 is NOT deduped (different real curriculum).
//
//   3. legacyEmail5() — Pre-Lock-#48 path for the constitution Email 5 fallback.
//
// Engagement tagging: every send carries campaign + email_key tags; Resend
// echoes them on open/click webhooks (-> public.email_events) for the founder
// dashboard. Tag values are [A-Za-z0-9_-] per Resend's rules.
//
// Failed sends (2026-09-16, _shared/send-backoff.ts): a transient Resend error
// (429, daily quota, 5xx, network) leaves the row pending with next_attempt_at
// pushed out on an exponential backoff, for up to 24 hours from first_failed_at.
// Every drain query skips rows still waiting out a backoff (dueFilter), so they
// never take a batch slot from rows that are due. After 24 hours the row is
// marked failed with gave_up_at set, and alertFounderOfGiveUps() emails the
// founder one summary (founder_alerted_at: once per row, at most one email an
// hour). A permanent error (400 validation, invalid address) fails at once, as
// before. Nothing about WHEN a row counts as sent changed: status and markSent
// are exactly as they were, so a sent row is never picked up again.
//
// Behavioral suppression (Phase 1): drainNurtureQueue cancels a queued email
// that would re-pitch an offer the recipient already bought. Phase 2 (branch to
// a DIFFERENT next email) is deferred until the full K-12 curriculum exists.

import {
  buildNurtureEmail2,
  buildNurtureEmail3,
  buildNurtureEmail4,
  buildNurtureEmail5,
  buildNurtureArc1,
  buildNurtureArc2,
  buildNurtureArc3,
  buildStarterOfferEmail,
  buildMagnetWeek3FacebookEmail,
  toSlug,
} from '../_shared/nurture-email-templates.ts';
import {
  buildMagnetWeek4Email,
  buildMagnetWeek5Email,
  buildMagnetWeek6Email,
  buildMagnetWeek7Email,
} from '../_shared/homeschool-followup-templates.ts';
import {
  buildLaunchEmail,
  variantForEmail,
  EMAIL_7_RESEND_POSITION,
} from '../_shared/launch-sequence-templates.ts';
import { foundersFormUrl } from '../_shared/founders-link.ts';
import { buildBuyerEmail } from '../_shared/buyer-sequence-templates.ts';
import { applyUnsub, type EmailList } from '../_shared/email-unsubscribe.ts';
import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';
import { pgrstFetch } from '../_shared/pgrst-retry.ts';
import { captureException } from '../_shared/sentry.ts';
import { escapeLikePattern } from '../_shared/like-escape.ts';
import { dueFilter, planSendFailure, type SendFailure } from '../_shared/send-backoff.ts';
import { alertFounder } from '../_shared/founder-alert.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const QUEUE_BATCH = 50;
const RATE_LIMIT_MS = 300;

// All five drains share one invocation, and the edge worker is killed at about
// 150 s (contact-properties-sync hit WORKER_RESOURCE_LIMIT there on 2026-09-03).
// Past this budget no new row is picked up, so the run ends before the worker is
// killed mid-row (between a Resend send and markSent, which would re-send it next
// tick). Untouched rows stay pending for the next tick.
const RUN_BUDGET_MS = 110_000;
let runDeadline = 0;
function budgetExhausted(): boolean {
  return Date.now() > runDeadline;
}

type ResendTag = { name: string; value: string };

// sequence_position → engagement email_key for the quiz/constitution drip.
// Positions 2-4 are the constitution emails; 5-7 are the post-drip 3-arc.
const CONSTITUTION_KEY_BY_POS: Record<number, string> = {
  2: 'constitution_2',
  3: 'constitution_3',
  4: 'constitution_4',
  5: 'arc_1',
  6: 'arc_2',
  7: 'arc_3',
};

// Homeschool magnet positions 3-7 → engagement email_key (position 2 is keyed
// per-band as magnet_w2_<band> at the call site).
const MAGNET_KEY_BY_POS: Record<number, string> = {
  3: 'magnet_w3_fb',
  4: 'magnet_w4_course',
  5: 'magnet_w5_cards',
  6: 'magnet_w6_herb',
  7: 'magnet_w7_devotional',
};

// Band-agnostic positions: identical copy regardless of band, so a both-band
// family should receive each ONCE. Week 2 is band-specific and excluded.
const MAGNET_BAND_AGNOSTIC = new Set<number>([3, 4, 5, 6, 7]);

// Chained scheduling: when position N sends, enqueue N+1 at +7 days. Only
// position 2 is enqueued (resend-waitlist, since 2026-07-28). Position 3 and
// the 4-7 chain are DORMANT: nothing enqueues 3, so this map never fires. Kept
// so the tail can be re-enabled by enqueueing 3 again; see migration
// 20260728234500.
const MAGNET_CHAIN_NEXT: Record<number, number> = { 3: 4, 4: 5, 5: 6, 6: 7 };
const MAGNET_CHAIN_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

// Positions whose builder actually reads `founding` (launch-sequence-templates.ts).
// 8-12 and 19-21 ignore it, so the volatile founding_gate RPC is only worth
// calling for these.
const FOUNDING_AWARE_POSITIONS = new Set<number>([13, 14, 15, 16, 17]);

// July 2026 Sprouts preorder launch sequence (launch_email_queue). All 7 rows
// are enqueued up front (backfill script for the fixed-date cohort; the
// enqueue_launch_sequence_on_signup DB trigger for post-July-9 signups), so
// there is no chaining. Larger batch than the evergreen queues: launch day
// puts ~1,500 rows due at the same instant, and at 50/run the tail would send
// ~7 hours late. 200 rows x 300 ms ≈ 60 s of sleep alone, before the per-row
// lookups and the Resend call, so a full batch may not finish in one run: the
// whole invocation is time-boxed by RUN_BUDGET_MS and the tail sends next tick.
const LAUNCH_QUEUE_BATCH = 200;

function engagementTags(campaign: string, emailKey: string): ResendTag[] {
  return [
    { name: 'campaign', value: campaign },
    { name: 'email_key', value: emailKey },
  ];
}

// ── Phase 1 behavioral suppression (quiz/constitution drip) ──
// Returns true if the queued email at this sequence_position would re-pitch an
// offer the recipient already bought, and should therefore be cancelled rather
// than sent. Mapping reflects the CURRENT sequence:
//   pos 2/3/4 → primary CTA is the Foundations course
//   pos 5 (arc-1) → pitches BOTH the $4.99 guide AND the course
//   pos 6/7 (app+book, homeschool+FB) → no guide/course purchase to gate on
// A course-buyer who has NOT bought the guide should still receive arc-1 (the
// guide half is still relevant), so pos 5 is only suppressed when BOTH are owned.
// REVISIT this mapping when the offer-ladder revamp re-sequences pitches.
function shouldSuppress(
  position: number,
  purchasedCourse: boolean,
  purchasedGuide: boolean,
): boolean {
  if ((position === 2 || position === 3 || position === 4) && purchasedCourse) return true;
  if (position === 5 && purchasedCourse && purchasedGuide) return true;
  return false;
}

async function supabaseQuery(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const res = await pgrstFetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:
        options.method === 'PATCH' ? 'return=minimal' : 'return=representation',
      ...options.headers,
    },
  });
  if (options.method === 'PATCH') return { ok: res.ok, status: res.status };
  return res.json();
}

// Runs AFTER Resend accepted the email. If the row is not marked, the next run
// sends the same email again: a gateway 504 on this PATCH did exactly that on
// 2026-09-11 (constitution_5 five times to one subscriber) and 2026-09-13.
// pgrstFetch already retried it; if it still failed, say so loudly instead of
// carrying on as if it had worked. Never throws, so a failed mark cannot fall
// into a caller's catch and be counted as a failed send.
async function markSent(
  table: string,
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  let status: number | string;
  try {
    const res = await supabaseQuery(`${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    if (res.ok) return;
    status = res.status;
  } catch (err) {
    status = err instanceof Error ? err.name : 'error';
  }
  const message = `sent but could not mark ${table} ${id} (${status}); the next run will send this email again`;
  console.error(`nurture-emails: ${message}`);
  await captureException(new Error(message), { function: 'nurture-emails', table, id, status });
}

// Enqueue the next magnet position for this recipient at +7 days. Idempotent via
// the (recipient_email, band, sequence_position) conflict target + merge.
async function enqueueNextMagnet(row: any, nextPos: number): Promise<void> {
  const scheduledFor = new Date(Date.now() + MAGNET_CHAIN_DELAY_MS).toISOString();
  const res = await pgrstFetch(
    `${SUPABASE_URL}/rest/v1/magnet_email_queue?on_conflict=recipient_email,band,sequence_position`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify([
        {
          recipient_email: row.recipient_email,
          first_name: row.first_name || 'friend',
          band: row.band,
          sequence_position: nextPos,
          scheduled_for: scheduledFor,
          status: 'pending',
        },
      ]),
    },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '<unreadable>');
    console.error('enqueueNextMagnet failed', { status: res.status, body: t, nextPos, email: row.recipient_email });
  }
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  list: EmailList,
  tags?: ResendTag[],
): Promise<{ ok: boolean; error?: string; status?: number; name?: string }> {
  const { html: finalHtml, headers: unsubHeaders } = await applyUnsub(html, to, list);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Camila at The Eden Institute <hello@edeninstitute.health>',
      reply_to: 'hello@edeninstitute.health',
      to: [to],
      subject,
      html: finalHtml,
      headers: unsubHeaders,
      ...(tags && tags.length ? { tags } : {}),
    }),
  });
  // A gateway 502/503 can answer with an HTML page; reading it as JSON must not
  // throw, or a transient outage would be recorded without its status.
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Email send failed:', res.status, JSON.stringify(data));
    return {
      ok: false,
      error: data?.message || `HTTP ${res.status}`,
      status: res.status,
      name: typeof data?.name === 'string' ? data.name : undefined,
    };
  }
  return { ok: true };
}

// A failed send: transient errors back off for up to 24 hours, permanent ones
// fail now (_shared/send-backoff.ts). Only a row that is marked failed counts in
// result.failed; a row that will be retried counts in result.retrying.
async function recordSendFailure(
  table: string,
  row: any,
  failure: SendFailure,
  result: QueueResult,
): Promise<void> {
  const now = new Date();
  const plan = planSendFailure(row, failure, now);
  try {
    const res = await supabaseQuery(`${table}?id=eq.${row.id}&status=eq.pending`, {
      method: 'PATCH',
      body: JSON.stringify({ ...plan.patch, updated_at: now.toISOString() }),
    });
    if (!res.ok) {
      // Left pending with its old next_attempt_at: it is simply tried again next tick.
      console.error(`nurture-emails: could not record failure on ${table} ${row.id} (${res.status})`);
    }
  } catch (err) {
    // Never let a lost PATCH end the whole drain run; same outcome as a non-ok PATCH.
    console.error(`nurture-emails: recording failure on ${table} ${row.id} threw:`, err instanceof Error ? err.message : String(err));
  }
  if (plan.action === 'retry') {
    result.retrying++;
  } else {
    result.failed++;
    if (plan.reason === 'window_expired') {
      console.error(`nurture-emails: ${table} ${row.id} gave up after 24h of retries: ${plan.patch.error_message}`);
    }
  }
}

// Voluntary per-list opt-out check (vs. the global unsubscribe handled by
// resend-webhook + the cancel_queued_emails_on_unsubscribe trigger).
async function isUnsubscribed(email: string, list: EmailList): Promise<boolean> {
  const rows = await supabaseQuery(
    `email_list_unsubscribes?email=eq.${encodeURIComponent(
      email.trim().toLowerCase(),
    )}&list=eq.${list}&select=email&limit=1`,
  );
  return Array.isArray(rows) && rows.length > 0;
}

interface QueueResult {
  processed: number;
  sent: number;
  failed: number;
  retrying: number;
}

async function drainNurtureQueue(): Promise<QueueResult> {
  const result: QueueResult = { processed: 0, sent: 0, failed: 0, retrying: 0 };
  const nowIso = new Date().toISOString();

  // Pull pending rows that are due. Order by scheduled_for ASC = oldest first.
  const rows = await supabaseQuery(
    `nurture_email_queue?status=eq.pending&scheduled_for=lte.${encodeURIComponent(
      nowIso,
    )}&${dueFilter(nowIso)}&order=scheduled_for.asc&limit=${QUEUE_BATCH}`,
  );

  if (!Array.isArray(rows)) {
    console.error(
      'drainNurtureQueue: unexpected query result',
      JSON.stringify(rows),
    );
    return result;
  }

  console.log(`drainNurtureQueue: found ${rows.length} due rows`);

  for (const row of rows) {
    if (budgetExhausted()) {
      console.log('nurture-emails: run budget reached, remaining rows left pending for next tick');
      break;
    }
    result.processed++;
    try {
      // Enrich from quiz_completions (queue stores recipient_email +
      // constitution_pattern, but we need first_name + the rich
      // constitution_name/slug too, plus the purchase flags for suppression).
      const qcRows = await supabaseQuery(
        `quiz_completions?email=eq.${encodeURIComponent(
          row.recipient_email,
        )}&order=completed_at.desc&limit=1`,
      );
      if (!Array.isArray(qcRows) || qcRows.length === 0) {
        console.error(
          `drainNurtureQueue: no quiz_completions row for ${row.recipient_email}`,
        );
        await supabaseQuery(`nurture_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'failed',
            error_message: 'No quiz_completions row found',
            updated_at: new Date().toISOString(),
          }),
        });
        result.failed++;
        continue;
      }

      const qc = qcRows[0];
      const firstName = qc.first_name || 'friend';
      const nickname =
        qc.constitution_name ||
        qc.constitution_nickname ||
        row.constitution_pattern ||
        'Your Constitutional Type';
      const slug = qc.constitution_type || toSlug(nickname);

      if (await isUnsubscribed(row.recipient_email, 'constitution')) {
        await supabaseQuery(`nurture_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            error_message: 'recipient unsubscribed (constitution)',
            updated_at: new Date().toISOString(),
          }),
        });
        continue;
      }

      // Phase 1 behavioral suppression: don't re-pitch an already-purchased offer.
      const purchasedCourse = qc.purchased_course === true;
      const purchasedGuide = qc.purchased_guide === true;
      if (shouldSuppress(row.sequence_position, purchasedCourse, purchasedGuide)) {
        await supabaseQuery(`nurture_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            error_message: `suppressed: already purchased (course=${purchasedCourse}, guide=${purchasedGuide})`,
            updated_at: new Date().toISOString(),
          }),
        });
        continue;
      }

      let built: { subject: string; html: string };
      switch (row.sequence_position) {
        case 2:
          built = buildNurtureEmail2(nickname, slug);
          break;
        case 3:
          built = buildNurtureEmail3(nickname, slug);
          break;
        case 4:
          built = buildNurtureEmail4(nickname, slug);
          break;
        case 5:
          built = buildNurtureArc1(firstName, nickname, slug);
          break;
        case 6:
          built = buildNurtureArc2(firstName, nickname, slug);
          break;
        case 7:
          built = buildNurtureArc3(firstName, nickname, slug);
          break;
        default:
          console.error(
            `drainNurtureQueue: unknown sequence_position ${row.sequence_position}`,
          );
          await supabaseQuery(`nurture_email_queue?id=eq.${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'failed',
              error_message: `Unknown sequence_position ${row.sequence_position}`,
              updated_at: new Date().toISOString(),
            }),
          });
          result.failed++;
          continue;
      }

      const emailKey =
        CONSTITUTION_KEY_BY_POS[row.sequence_position] ??
        `constitution_pos${row.sequence_position}`;
      const send = await sendEmail(
        row.recipient_email,
        built.subject,
        built.html,
        'constitution',
        engagementTags('constitution', emailKey),
      );
      if (send.ok) {
        await markSent('nurture_email_queue', row.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        result.sent++;
      } else {
        await recordSendFailure('nurture_email_queue', row, { status: send.status, name: send.name, message: send.error }, result);
      }

      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`drainNurtureQueue: row ${row.id} threw:`, message);
      // Thrown before or during the send (network, a gateway error on a lookup):
      // no response from Resend, so it is treated as transient.
      await recordSendFailure('nurture_email_queue', row, { status: null, message }, result);
    }
  }

  return result;
}

interface LegacyResult {
  sent: number;
  candidates: number;
}

async function legacyEmail5(): Promise<LegacyResult> {
  const rows = await supabaseQuery(
    'quiz_completions?email_5_sent_at=is.null&email_4_sent_at=not.is.null&purchased_course=eq.false&purchased_guide=eq.false&limit=50',
  );

  if (!Array.isArray(rows)) {
    console.error('legacyEmail5: unexpected query result', JSON.stringify(rows));
    return { sent: 0, candidates: 0 };
  }

  const candidates = rows.length;
  let sent = 0;
  const now = new Date();

  for (const row of rows) {
    if (budgetExhausted()) {
      console.log('nurture-emails: run budget reached, remaining rows left pending for next tick');
      break;
    }
    const completedAt = new Date(row.completed_at);
    const hoursSince =
      (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 192) continue;
    if (row.purchased_course) continue;
    if (row.purchased_guide) continue;
    if (await isUnsubscribed(row.email, 'constitution')) continue;

    const nickname =
      row.constitution_name ||
      row.constitution_nickname ||
      'Your Constitutional Type';
    const slug = row.constitution_type || toSlug(nickname);
    const { subject, html } = buildNurtureEmail5(nickname, slug);

    const send = await sendEmail(
      row.email,
      subject,
      html,
      'constitution',
      engagementTags('constitution', 'constitution_5'),
    );
    if (send.ok) {
      await markSent('quiz_completions', row.id, { email_5_sent_at: now.toISOString() });
      sent++;
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  return { sent, candidates };
}

type MagnetResult = QueueResult;

// Story-move cutoff: the read-aloud story now ships with Week 2 (Email 2), not
// Week 1 (Email 1). Magnet queue rows created at/after this timestamp were
// enqueued by the post-deploy resend-waitlist whose Week-1 email no longer
// carries the story, so their Week-2 email includes it. Rows created before this
// (last week's ~1,100 leads) already received the story in Week 1 and are NOT
// re-sent it. Set this AT OR BEFORE the deploy moment — never after: a signup
// between this cutoff and the actual deploy harmlessly receives the story in
// both weeks, whereas a cutoff later than the deploy would leave a brand-new
// lead with no story at all.
const STORY_CUTOFF_MS = Date.parse('2026-06-06T22:38:00Z');

// Lock #83 / Phase 3.1.2: drains public.magnet_email_queue. Week 2 (band-specific)
// + Week 3-7 (band-agnostic). No quiz_completions row needed; first name comes
// from the queue row. Band-agnostic positions are deduped per recipient; Weeks
// 4-7 are chained (each send enqueues the next).
async function drainMagnetQueue(): Promise<MagnetResult> {
  const result: MagnetResult = { processed: 0, sent: 0, failed: 0, retrying: 0 };
  const nowIso = new Date().toISOString();
  // Tracks (email|position) for band-agnostic emails already handled in THIS
  // run, so two band rows due in the same batch don't both send.
  const sentAgnostic = new Set<string>();
  const rows = await supabaseQuery(
    `magnet_email_queue?status=eq.pending&scheduled_for=lte.${encodeURIComponent(nowIso)}&${dueFilter(nowIso)}&order=scheduled_for.asc&limit=${QUEUE_BATCH}`,
  );
  if (!Array.isArray(rows)) {
    console.error('drainMagnetQueue: unexpected query result', JSON.stringify(rows));
    return result;
  }
  console.log(`drainMagnetQueue: found ${rows.length} due rows`);
  for (const row of rows) {
    if (budgetExhausted()) {
      console.log('nurture-emails: run budget reached, remaining rows left pending for next tick');
      break;
    }
    result.processed++;
    // Set once Resend has accepted this row's email. A throw after that point
    // (chaining the next week) must not put the row back up for a resend.
    let accepted = false;
    try {
      const firstName = row.first_name || 'friend';
      const band: 'sprouts' | 'seedlings' = row.band === 'seedlings' ? 'seedlings' : 'sprouts';
      const pos = row.sequence_position;
      const email = String(row.recipient_email);

      if (await isUnsubscribed(email, 'homeschool')) {
        await supabaseQuery(`magnet_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            error_message: 'recipient unsubscribed (homeschool)',
            updated_at: new Date().toISOString(),
          }),
        });
        continue;
      }

      // Band-agnostic dedup: a both-band family should get positions 3-7 once.
      // Check the in-run set first, then whether a sibling row already sent.
      const dedupeKey = `${email.toLowerCase()}|${pos}`;
      if (MAGNET_BAND_AGNOSTIC.has(pos)) {
        let already = sentAgnostic.has(dedupeKey);
        if (!already) {
          const prior = await supabaseQuery(
            `magnet_email_queue?recipient_email=eq.${encodeURIComponent(email)}&sequence_position=eq.${pos}&status=eq.sent&select=id&limit=1`,
          );
          already = Array.isArray(prior) && prior.length > 0;
        }
        if (already) {
          await supabaseQuery(`magnet_email_queue?id=eq.${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'cancelled',
              error_message: 'deduped: band-agnostic email already sent to this recipient',
              updated_at: new Date().toISOString(),
            }),
          });
          continue;
        }
      }

      let built: { subject: string; html: string };
      let emailKey: string;
      if (pos === 2) {
        // Position 2 used to deliver the free Week 2 downloads. Retired 2026-08-27
        // when the lead magnet dropped to ONE free week; the slot now carries the
        // paid Starter Unit offer instead of ending the free arc on a Facebook
        // teaser that sold nothing. New engagement key so the founder dashboard
        // does not silently merge two different emails under one label.
        built = buildStarterOfferEmail(firstName, band);
        emailKey = `magnet_starter_offer_${band}`;
      } else if (pos === 3) {
        built = buildMagnetWeek3FacebookEmail(firstName);
        emailKey = MAGNET_KEY_BY_POS[3];
      } else if (pos === 4) {
        built = buildMagnetWeek4Email(firstName);
        emailKey = MAGNET_KEY_BY_POS[4];
      } else if (pos === 5) {
        built = buildMagnetWeek5Email(firstName);
        emailKey = MAGNET_KEY_BY_POS[5];
      } else if (pos === 6) {
        built = buildMagnetWeek6Email(firstName);
        emailKey = MAGNET_KEY_BY_POS[6];
      } else if (pos === 7) {
        built = buildMagnetWeek7Email(firstName);
        emailKey = MAGNET_KEY_BY_POS[7];
      } else {
        await supabaseQuery(`magnet_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'failed', error_message: `Unknown sequence_position ${pos}`, updated_at: new Date().toISOString() }),
        });
        result.failed++;
        continue;
      }

      const send = await sendEmail(
        email,
        built.subject,
        built.html,
        'homeschool',
        engagementTags('homeschool', emailKey),
      );
      if (send.ok) {
        accepted = true;
        await markSent('magnet_email_queue', row.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        result.sent++;
        if (MAGNET_BAND_AGNOSTIC.has(pos)) sentAgnostic.add(dedupeKey);
        // Chain the next follow-up (Weeks 4-7) at +7 days.
        const nextPos = MAGNET_CHAIN_NEXT[pos];
        if (nextPos) await enqueueNextMagnet(row, nextPos);
      } else {
        await recordSendFailure('magnet_email_queue', row, { status: send.status, name: send.name, message: send.error }, result);
      }
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`drainMagnetQueue: row ${row.id} threw:`, message);
      if (accepted) {
        await captureException(err, { function: 'nurture-emails', table: 'magnet_email_queue', id: row.id, stage: 'after-send' });
        continue;
      }
      await recordSendFailure('magnet_email_queue', row, { status: null, message }, result);
    }
  }
  return result;
}

// July 2026 launch sequence: drains public.launch_email_queue. No bands, no
// chaining, no cross-row dedup (the unique (recipient_email, sequence_position)
// constraint guarantees one row per email per recipient); each row is simply
// sent when due. Homeschool list rules apply: per-list voluntary opt-outs are
// honored here, and global unsubscribes/bounces are handled upstream by the
// cancel_queued_emails_on_unsubscribe trigger (extended to this table in
// migration 20260702190000).
//
// ALL launch positions are PURCHASE-SUPPRESSED: a recipient with any order
// that is not cancelled/refunded already preordered, so every remaining
// launch email (vision arc included; a buyer should not get "the doors are
// about to open") is cancelled instead of sent. Two layers: the
// cancel_launch_emails_on_order trigger fires at purchase time (migration
// 20260703093000), and this drain-time check catches anything that slips
// between trigger and send. Before PR #227's migration creates
// public.orders, the query errors and this returns false, which is correct:
// nobody can have preordered yet.

// True if this recipient has a live (not cancelled/refunded) order.
// ilike is used for case-insensitivity; _ and % are LIKE wildcards, so they
// are escaped to make this literal equality (jane_doe must not match janeadoe).
async function hasPreordered(email: string): Promise<boolean> {
  const literal = escapeLikePattern(email);
  const rows = await supabaseQuery(
    `orders?customer_email=ilike.${encodeURIComponent(literal)}&status=not.in.(cancelled,refunded)&select=id&limit=1`,
  );
  return Array.isArray(rows) && rows.length > 0;
}

// ── Founding-window check (copy variant for the retired positions 13-17) ──
// Reads the SAME latch-aware gate the checkout enforces (founding_gate RPC,
// migration 20260717170000): net founding units SUM(quantity) vs
// products.founding_qty_limit, plus the one-way founding_closed_at latch, so
// email copy can never drift from billing and can never flip back to founding
// after a refund. POST because the RPC is volatile (it stamps the latch the
// first time the cap is reached). While open, conversion copy carries the
// $249 founding offer; once closed, the copy drops "founding" entirely and
// quotes $349 flat. Computed at most once per drain run. Fails toward TRUE
// (founding copy) so a transient query error during the founding window
// cannot prematurely flip the list to retail copy; create-checkout
// independently enforces the real price either way.
const FOUNDING_GATE_SKU = 'sprouts_kit';

async function foundingWindowOpen(): Promise<boolean> {
  try {
    const products = await supabaseQuery(
      `products?sku=eq.${FOUNDING_GATE_SKU}&select=id&limit=1`,
    );
    if (!Array.isArray(products) || products.length === 0) return true;
    const res = await pgrstFetch(`${SUPABASE_URL}/rest/v1/rpc/founding_gate`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_product_id: products[0].id }),
    });
    if (!res.ok) return true;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row.closed !== 'boolean') return true;
    return !row.closed;
  } catch (err) {
    console.error('foundingWindowOpen check failed; defaulting to founding copy:', String(err));
    return true;
  }
}

async function drainLaunchQueue(): Promise<QueueResult> {
  const result: QueueResult = { processed: 0, sent: 0, failed: 0, retrying: 0 };
  const nowIso = new Date().toISOString();
  const rows = await supabaseQuery(
    `launch_email_queue?status=eq.pending&scheduled_for=lte.${encodeURIComponent(nowIso)}&${dueFilter(nowIso)}&order=scheduled_for.asc&limit=${LAUNCH_QUEUE_BATCH}`,
  );
  if (!Array.isArray(rows)) {
    console.error('drainLaunchQueue: unexpected query result', JSON.stringify(rows));
    return result;
  }
  if (rows.length > 0) console.log(`drainLaunchQueue: found ${rows.length} due rows`);
  // One founding-gate check per run, only when a row whose builder reads
  // `founding` is due (the retired 13-17). founding_gate is a volatile RPC that
  // stamps the one-way founding_closed_at latch, so it is not called for nothing.
  let founding = true;
  if (rows.some((r: any) => FOUNDING_AWARE_POSITIONS.has(r.sequence_position))) {
    founding = await foundingWindowOpen();
    if (!founding) console.log('drainLaunchQueue: founding window CLOSED, using retail copy');
  }
  for (const row of rows) {
    if (budgetExhausted()) {
      console.log('nurture-emails: run budget reached, remaining rows left pending for next tick');
      break;
    }
    result.processed++;
    try {
      const email = String(row.recipient_email);
      const firstName = row.first_name || 'friend';
      const pos = row.sequence_position;

      if (await isUnsubscribed(email, 'homeschool')) {
        await supabaseQuery(`launch_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            error_message: 'recipient unsubscribed (homeschool)',
            updated_at: new Date().toISOString(),
          }),
        });
        continue;
      }

      // The whole launch sequence stops the moment a family preorders.
      if (await hasPreordered(email)) {
        await supabaseQuery(`launch_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            error_message: 'suppressed: recipient already preordered',
            updated_at: new Date().toISOString(),
          }),
        });
        continue;
      }

      // Email 7's Reserve button points at the founders-price page, which
      // disables itself unless the URL carries a signed `?t=` token. Sign it
      // per recipient; every other position ignores this argument. Position 18
      // is the Email 7 make-good resend and carries the same button, so it is
      // signed with the same 'launch_7' source: a reservation captured from
      // either send is the same founder from the same campaign, and
      // founders_interest.source stays comparable across the two.
      const foundersUrl =
        pos === 7 || pos === EMAIL_7_RESEND_POSITION
          ? await foundersFormUrl(email, firstName, 'launch_7')
          : undefined;

      // Position 18 runs a subject-line split test. The arm is derived from the
      // address, not from a counter or a random draw, so a retry after a send
      // failure cannot move someone between arms and skew the read.
      const variant = variantForEmail(email);

      const built = buildLaunchEmail(pos, firstName, founding, foundersUrl, variant);
      if (!built) {
        await supabaseQuery(`launch_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'failed',
            error_message: `Unknown sequence_position ${pos}`,
            updated_at: new Date().toISOString(),
          }),
        });
        result.failed++;
        continue;
      }

      // Position 18 is tagged launch_7_resend_<arm>, not launch_18, so the
      // make-good's opens and clicks are measurable against launch_7's own
      // numbers in email_events instead of hiding behind a position number
      // nothing else uses, and so the two subject lines can be scored against
      // each other. Resend tag values allow [A-Za-z0-9_-] only.
      const emailKey =
        pos === EMAIL_7_RESEND_POSITION
          ? `launch_7_resend_${variant}`
          : `launch_${pos}`;
      const send = await sendEmail(
        email,
        built.subject,
        built.html,
        'homeschool',
        engagementTags('launch_2026', emailKey),
      );
      if (send.ok) {
        await markSent('launch_email_queue', row.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        result.sent++;
      } else {
        await recordSendFailure('launch_email_queue', row, { status: send.status, name: send.name, message: send.error }, result);
      }
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`drainLaunchQueue: row ${row.id} threw:`, message);
      // Thrown before or during the send (network, a gateway error on a lookup):
      // no response from Resend, so it is treated as transient.
      await recordSendFailure('launch_email_queue', row, { status: null, message }, result);
    }
  }
  return result;
}

// ── Buyer nurture (public.buyer_email_queue) ──────────────────────────────
// The other half of the launch queue's purchase suppression. When a family
// preorders, every pending launch row for them is cancelled, which before this
// left them with one confirmation email and roughly fourteen weeks of silence
// until the kit shipped. Six emails now carry them across that wait.
//
// Rows are keyed by ORDER, not by email, so a family who buys twice gets one
// sequence per order rather than losing the second to a unique-email conflict.
//
// Two independent guards, because the cost of getting this wrong is emailing
// someone about a kit they cancelled:
//   1. trg_cancel_buyer_sequence cancels pending rows the moment an order
//      turns cancelled or refunded
//   2. the order's CURRENT status is re-read here at send time, embedded in
//      the same query, in case a status changed without the trigger firing
//      (a direct SQL update, a restore from backup)
const BUYER_QUEUE_BATCH = 100;

async function drainBuyerQueue(): Promise<QueueResult> {
  const result: QueueResult = { processed: 0, sent: 0, failed: 0, retrying: 0 };
  const nowIso = new Date().toISOString();
  const rows = await supabaseQuery(
    `buyer_email_queue?select=id,order_id,recipient_email,first_name,sequence_position,retry_count,first_failed_at,orders(status)` +
      `&status=eq.pending&scheduled_for=lte.${encodeURIComponent(nowIso)}&${dueFilter(nowIso)}` +
      `&order=scheduled_for.asc&limit=${BUYER_QUEUE_BATCH}`,
  );
  if (!Array.isArray(rows)) {
    console.error('drainBuyerQueue: unexpected query result', JSON.stringify(rows));
    return result;
  }
  if (rows.length > 0) console.log(`drainBuyerQueue: found ${rows.length} due rows`);

  for (const row of rows) {
    if (budgetExhausted()) {
      console.log('nurture-emails: run budget reached, remaining rows left pending for next tick');
      break;
    }
    result.processed++;
    try {
      const email = String(row.recipient_email);
      const firstName = row.first_name || 'friend';
      const pos = row.sequence_position;
      const orderStatus = row.orders?.status;

      if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
        await supabaseQuery(`buyer_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            error_message: `order ${orderStatus}`,
            updated_at: new Date().toISOString(),
          }),
        });
        continue;
      }

      // Buyer emails have their own list (postpurchase, 2026-09-03) so a
      // homeschool-preview opt-out does not silence a paying buyer's updates.
      if (await isUnsubscribed(email, 'postpurchase')) {
        await supabaseQuery(`buyer_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            error_message: 'recipient unsubscribed (postpurchase)',
            updated_at: new Date().toISOString(),
          }),
        });
        continue;
      }

      const built = buildBuyerEmail(pos, firstName);
      if (!built) {
        await supabaseQuery(`buyer_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'failed',
            error_message: `Unknown buyer sequence_position ${pos}`,
            updated_at: new Date().toISOString(),
          }),
        });
        result.failed++;
        continue;
      }

      const send = await sendEmail(
        email,
        built.subject,
        built.html,
        'postpurchase',
        engagementTags('buyer_2026', `buyer_${pos}`),
      );
      if (send.ok) {
        await markSent('buyer_email_queue', row.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        result.sent++;
      } else {
        await recordSendFailure('buyer_email_queue', row, { status: send.status, name: send.name, message: send.error }, result);
      }
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`drainBuyerQueue: row ${row.id} threw:`, message);
      // Thrown before or during the send (network, a gateway error on a lookup):
      // no response from Resend, so it is treated as transient.
      await recordSendFailure('buyer_email_queue', row, { status: null, message }, result);
    }
  }
  return result;
}

// ── Founder alert for emails that gave up after 24 hours of retries ─────────
const BACKOFF_QUEUES = ['buyer_email_queue', 'nurture_email_queue', 'magnet_email_queue', 'launch_email_queue'] as const;
const GIVE_UP_ALERT_EVERY_MS = 60 * 60 * 1000;
const GIVE_UP_LIST_PER_QUEUE = 10;

function totalFromContentRange(header: string | null): number | null {
  const m = header?.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

// One summary email for every row that gave up and has not been reported.
// Rows are stamped founder_alerted_at only after Resend accepted the alert, so
// a failed alert is retried next run; and at most one alert goes out an hour,
// so a long outage produces one email an hour rather than one per row.
async function alertFounderOfGiveUps(): Promise<{ alerted: number; held?: string }> {
  const snapshot = new Date();
  const snapIso = encodeURIComponent(snapshot.toISOString());
  const recentIso = encodeURIComponent(new Date(snapshot.getTime() - GIVE_UP_ALERT_EVERY_MS).toISOString());
  const unreported = `status=eq.failed&gave_up_at=not.is.null&gave_up_at=lte.${snapIso}&founder_alerted_at=is.null`;

  const sections: string[] = [];
  let total = 0;
  for (const table of BACKOFF_QUEUES) {
    const res = await pgrstFetch(
      `${SUPABASE_URL}/rest/v1/${table}?${unreported}&select=id,recipient_email,sequence_position,error_message,gave_up_at` +
        `&order=gave_up_at.asc&limit=${GIVE_UP_LIST_PER_QUEUE}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'count=exact',
        },
      },
    );
    if (!res.ok) {
      await res.body?.cancel();
      return { alerted: 0, held: `${table} read failed (${res.status})` };
    }
    const rows = await res.json().catch(() => []) as Array<{ recipient_email: string; sequence_position: number; error_message: string | null }>;
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const count = totalFromContentRange(res.headers.get('content-range')) ?? rows.length;
    total += count;
    sections.push(
      `${table}: ${count}\n` +
        rows.map((r) => `  - ${r.recipient_email}, position ${r.sequence_position}: ${(r.error_message ?? '').slice(0, 160)}`).join('\n') +
        (count > rows.length ? `\n  (and ${count - rows.length} more)` : ''),
    );
  }
  if (total === 0) return { alerted: 0 };

  for (const table of BACKOFF_QUEUES) {
    const recent = await supabaseQuery(`${table}?founder_alerted_at=gte.${recentIso}&select=id&limit=1`);
    if (Array.isArray(recent) && recent.length > 0) return { alerted: 0, held: 'an alert already went out this hour' };
  }

  const subject = `${total} queued email${total === 1 ? '' : 's'} gave up after 24 hours of retries`;
  const text =
    `${total} queued email${total === 1 ? ' was' : 's were'} retried for 24 hours and never went through, so ` +
    `${total === 1 ? 'it is' : 'they are'} now marked failed and will not send on ${total === 1 ? 'its' : 'their'} own.\n\n` +
    `The usual cause is Resend refusing sends for the whole day (rate limit or daily quota). ` +
    `Check the Resend dashboard first.\n\n` +
    sections.join('\n\n') +
    `\n\nTo send them after all, set status back to pending and clear first_failed_at, next_attempt_at, ` +
    `gave_up_at and founder_alerted_at on those rows. Claude can do that for you.\n\n` +
    `You get this email once for each email that gave up.`;

  const sent = await alertFounder(subject, text, 'nurture-emails');
  if (!sent) return { alerted: 0, held: 'alert email failed; will retry next run' };

  for (const table of BACKOFF_QUEUES) {
    const res = await supabaseQuery(`${table}?${unreported}`, {
      method: 'PATCH',
      body: JSON.stringify({ founder_alerted_at: snapshot.toISOString() }),
    });
    if (!res.ok) console.error(`nurture-emails: alert sent but could not stamp founder_alerted_at on ${table} (${res.status})`);
  }
  return { alerted: total };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal cron worker: only the service role (via the Vercel cron) may invoke.
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(corsHeaders);

  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing env vars');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    runDeadline = Date.now() + RUN_BUDGET_MS;
    // Small transactional buyer queue first; the 200-row launch batch runs last
    // before the legacy fallback, so a full launch backlog cannot starve buyers.
    const buyer = await drainBuyerQueue();
    const queue = await drainNurtureQueue();
    const magnet = await drainMagnetQueue();
    const launch = await drainLaunchQueue();
    const legacy_email5 = await legacyEmail5();
    const budget_exhausted = budgetExhausted();
    // Never lets an alert problem fail the drain run.
    const gave_up_alert = await alertFounderOfGiveUps().catch((err) => {
      console.error('nurture-emails: give-up alert pass threw', err instanceof Error ? err.message : String(err));
      return { alerted: 0, held: 'threw' };
    });

    console.log(
      `nurture-emails run: queue=${JSON.stringify(
        queue,
      )} magnet=${JSON.stringify(magnet)} launch=${JSON.stringify(launch)} buyer=${JSON.stringify(buyer)} legacy_email5=${JSON.stringify(legacy_email5)} budget_exhausted=${budget_exhausted} gave_up_alert=${JSON.stringify(gave_up_alert)}`,
    );

    return new Response(
      JSON.stringify({ success: true, queue, magnet, launch, buyer, legacy_email5, budget_exhausted, gave_up_alert }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('nurture-emails error:', message, stack);
    return new Response(
      JSON.stringify({ error: 'Internal error processing nurture batch.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
