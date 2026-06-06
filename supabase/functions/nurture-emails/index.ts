// nurture-emails — Lock #48 queue drainer + legacy Email 5 fallback
//
// Caller: Vercel cron at /api/cron/drain-nurture-queue (every 15 min, per vercel.json)
// Auth: Caller sends Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>; EF has verify_jwt=false
// (verify_jwt=false because this is an internal cron worker; the protection is the
//  Vercel-cron-only origin + service-role-key inbound + no public route discovery).
//
// Two flows handled in order:
//
//   1. drainNurtureQueue() — Lock #48 consumer side. Pulls public.nurture_email_queue
//      rows where status='pending' AND scheduled_for <= now(). For each row, looks up
//      the matching quiz_completions row by email to enrich with first_name +
//      constitution data, then builds Email 2/3/4 via the shared templates and sends
//      via Resend. Updates the queue row status to 'sent' (success) or 'pending' with
//      incremented retry_count (transient fail) or 'failed' (after 3 retries / permanent).
//
//   2. legacyEmail5() — Pre-Lock-#48 path. Pulls quiz_completions rows that are 8+ days
//      post-quiz, have Email 4 sent, and have NOT purchased course or guide. Sends the
//      Amazon-affiliate "starter kit" fallback (Email 5) and stamps email_5_sent_at.
//
// Response shape — matches api/cron/drain-nurture-queue.ts's EFResponse interface:
//   {
//     success: true,
//     queue: { processed: N, sent: N, failed: N },
//     legacy_email5: { sent: N, candidates: N }
//   }
//
// 2026-05-19 (v22): RESTORES the queue-drainer logic that was deployed as v17 on
// 2026-04-28 and silently overwritten by a later main-branch resync (the drainer
// code lived only on the Supabase server-side, never in git). This deploy commits
// the drainer to main so future resyncs can't repeat the regression.

import {
  buildNurtureEmail2,
  buildNurtureEmail3,
  buildNurtureEmail4,
  buildNurtureEmail5,
  buildNurtureArc1,
  buildNurtureArc2,
  buildNurtureArc3,
  buildMagnetWeek2Email,
  buildMagnetWeek3FacebookEmail,
  toSlug,
} from '../_shared/nurture-email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const MAX_RETRIES = 3;
const QUEUE_BATCH = 50;
const RATE_LIMIT_MS = 300;

async function supabaseQuery(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
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
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Email send failed:', res.status, JSON.stringify(data));
    return { ok: false, error: data?.message || `HTTP ${res.status}` };
  }
  return { ok: true };
}

interface QueueResult {
  processed: number;
  sent: number;
  failed: number;
}

async function drainNurtureQueue(): Promise<QueueResult> {
  const result: QueueResult = { processed: 0, sent: 0, failed: 0 };
  const nowIso = new Date().toISOString();

  // Pull pending rows that are due. Order by scheduled_for ASC = oldest first.
  const rows = await supabaseQuery(
    `nurture_email_queue?status=eq.pending&scheduled_for=lte.${encodeURIComponent(
      nowIso,
    )}&order=scheduled_for.asc&limit=${QUEUE_BATCH}`,
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
    result.processed++;
    try {
      // Enrich from quiz_completions (queue stores recipient_email +
      // constitution_pattern, but we need first_name + the rich
      // constitution_name/slug too).
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

      let built: { subject: string; html: string };
      switch (row.sequence_position) {
        case 2:
          built = buildNurtureEmail2(firstName, nickname, slug);
          break;
        case 3:
          built = buildNurtureEmail3(firstName, nickname, slug);
          break;
        case 4:
          built = buildNurtureEmail4(firstName, nickname, slug);
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

      const send = await sendEmail(row.recipient_email, built.subject, built.html);
      if (send.ok) {
        await supabaseQuery(`nurture_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
        result.sent++;
      } else {
        const newRetry = (row.retry_count ?? 0) + 1;
        const terminal = newRetry >= MAX_RETRIES;
        await supabaseQuery(`nurture_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: terminal ? 'failed' : 'pending',
            retry_count: newRetry,
            error_message: send.error,
            updated_at: new Date().toISOString(),
          }),
        });
        if (terminal) result.failed++;
      }

      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`drainNurtureQueue: row ${row.id} threw:`, message);
      const newRetry = (row.retry_count ?? 0) + 1;
      const terminal = newRetry >= MAX_RETRIES;
      await supabaseQuery(`nurture_email_queue?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: terminal ? 'failed' : 'pending',
          retry_count: newRetry,
          error_message: message,
          updated_at: new Date().toISOString(),
        }),
      });
      if (terminal) result.failed++;
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
    const completedAt = new Date(row.completed_at);
    const hoursSince =
      (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 192) continue;
    if (row.purchased_course) continue;
    if (row.purchased_guide) continue;

    const nickname =
      row.constitution_name ||
      row.constitution_nickname ||
      'Your Constitutional Type';
    const slug = row.constitution_type || toSlug(nickname);
    const { subject, html } = buildNurtureEmail5(
      row.first_name,
      nickname,
      slug,
    );

    const send = await sendEmail(row.email, subject, html);
    if (send.ok) {
      await supabaseQuery(`quiz_completions?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ email_5_sent_at: now.toISOString() }),
      });
      sent++;
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  return { sent, candidates };
}

interface MagnetResult {
  processed: number;
  sent: number;
  failed: number;
}

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

// Lock #83 / Phase 3.1.2: drains public.magnet_email_queue (Sprouts/Seedlings
// Week 2 day-7 + Facebook day-14). Unlike the quiz drip this needs NO
// quiz_completions row — first name comes from the queue row itself.
async function drainMagnetQueue(): Promise<MagnetResult> {
  const result: MagnetResult = { processed: 0, sent: 0, failed: 0 };
  const nowIso = new Date().toISOString();
  const rows = await supabaseQuery(
    `magnet_email_queue?status=eq.pending&scheduled_for=lte.${encodeURIComponent(nowIso)}&order=scheduled_for.asc&limit=${QUEUE_BATCH}`,
  );
  if (!Array.isArray(rows)) {
    console.error('drainMagnetQueue: unexpected query result', JSON.stringify(rows));
    return result;
  }
  console.log(`drainMagnetQueue: found ${rows.length} due rows`);
  for (const row of rows) {
    result.processed++;
    try {
      const firstName = row.first_name || 'friend';
      const band: 'sprouts' | 'seedlings' = row.band === 'seedlings' ? 'seedlings' : 'sprouts';
      let built: { subject: string; html: string };
      if (row.sequence_position === 3) {
        built = buildMagnetWeek3FacebookEmail(firstName);
      } else if (row.sequence_position === 2) {
        built = buildMagnetWeek2Email(firstName, band, Date.parse(row.created_at) >= STORY_CUTOFF_MS);
      } else {
        await supabaseQuery(`magnet_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'failed', error_message: `Unknown sequence_position ${row.sequence_position}`, updated_at: new Date().toISOString() }),
        });
        result.failed++;
        continue;
      }
      const send = await sendEmail(row.recipient_email, built.subject, built.html);
      if (send.ok) {
        await supabaseQuery(`magnet_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
        });
        result.sent++;
      } else {
        const newRetry = (row.retry_count ?? 0) + 1;
        const terminal = newRetry >= MAX_RETRIES;
        await supabaseQuery(`magnet_email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: terminal ? 'failed' : 'pending', retry_count: newRetry, error_message: send.error, updated_at: new Date().toISOString() }),
        });
        if (terminal) result.failed++;
      }
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`drainMagnetQueue: row ${row.id} threw:`, message);
      const newRetry = (row.retry_count ?? 0) + 1;
      const terminal = newRetry >= MAX_RETRIES;
      await supabaseQuery(`magnet_email_queue?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: terminal ? 'failed' : 'pending', retry_count: newRetry, error_message: message, updated_at: new Date().toISOString() }),
      });
      if (terminal) result.failed++;
    }
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const queue = await drainNurtureQueue();
    const magnet = await drainMagnetQueue();
    const legacy_email5 = await legacyEmail5();

    console.log(
      `nurture-emails run: queue=${JSON.stringify(
        queue,
      )} legacy_email5=${JSON.stringify(legacy_email5)}`,
    );

    return new Response(
      JSON.stringify({ success: true, queue, magnet, legacy_email5 }),
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
