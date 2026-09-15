// replay-quiz-completion-failures v3 — cron-driven worker that drains the
// quiz_completion_failures dead-letter queue.
//
// Auth (current): verify_jwt=true in supabase/config.toml, so the gateway
// validates the JWT signature, and the handler additionally requires
// role=service_role via _shared/require-service-role.ts (PR #234). The anon key
// cannot trigger a drain. History: v3 (PR #110) had temporarily removed a strict
// key comparison after a Vercel/Supabase key divergence; that posture is
// superseded.
//
// Architecture (mirror of Lock #48 nurture-emails consumer):
//   - Vercel cron POSTs every 30 min to /api/cron/replay-quiz-failures.
//   - That Vercel Edge fn verifies CRON_SECRET, then forwards here with the
//     service-role key in Authorization, which this EF checks.
//
// Drain semantics:
//   - Pull up to 10 unresolved rows whose retry_count is below
//     MAX_REPLAY_ATTEMPTS: never-retried first, then least-recently-retried,
//     then oldest. A stuck row therefore cannot block newer ones.
//   - For each, check the raw_payload with the same email and
//     constitution_type rules record-quiz-completion applies
//     (_shared/quiz-completion-input.ts), then replay it through a PostgREST
//     INSERT into quiz_completions.
//   - On 2xx: mark resolved_at + resolved_quiz_completion_id (where
//     derivable), bump retry counters.
//   - On 409: row already exists (UNIQUE on lower(email) added in parallel
//     work). Treat as resolved — the row was recorded by some earlier path,
//     the dead-letter row is no longer actionable.
//   - On non-2xx (other): increment retry_count, record last_retry_status
//     + body. Row stays unresolved — next cron tick retries, until
//     retry_count reaches MAX_REPLAY_ATTEMPTS.
//   - A payload that fails the local checks can never succeed, so it is parked
//     at once (retry_count set to MAX_REPLAY_ATTEMPTS). Parked rows are never
//     deleted or marked resolved: they stay pending in
//     quiz_completion_failure_stats for manual triage.

import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';
// Repeats reads and PATCHes the gateway 504s; the INSERT replay is never repeated.
import { pgrstFetch } from '../_shared/pgrst-retry.ts';
import { isValidConstitution, normalizeEmail, normalizeOptionalString } from '../_shared/quiz-completion-input.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const BATCH_SIZE = 10;
// A row that has failed this many replays (~24h at the 30-min cron) is parked for manual triage: it stays unresolved and visible in quiz_completion_failure_stats, but no longer occupies a batch slot.
const MAX_REPLAY_ATTEMPTS = 48;

interface FailureRow {
  id: string;
  raw_payload: Record<string, unknown>;
  retry_count: number;
}

interface DrainResult {
  processed: number;
  resolved: number;
  still_failing: number;
  errors: string[];
}

async function fetchPendingBatch(): Promise<FailureRow[]> {
  const url =
    `${SUPABASE_URL}/rest/v1/quiz_completion_failures` +
    `?select=id,raw_payload,retry_count` +
    `&resolved_at=is.null` +
    `&retry_count=lt.${MAX_REPLAY_ATTEMPTS}` +
    `&order=last_retry_at.asc.nullsfirst,received_at.asc` +
    `&limit=${BATCH_SIZE}`;
  const res = await pgrstFetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '<unreadable>');
    throw new Error(`fetchPendingBatch failed status=${res.status} body=${txt}`);
  }
  return await res.json();
}

async function replayInsert(row: FailureRow): Promise<{
  ok: boolean;
  status: number;
  body: string;
  insertedId: string | null;
  /** true when the payload itself is invalid, so replaying again cannot succeed. */
  terminal: boolean;
}> {
  const payload = row.raw_payload || {};
  const body = payload as Record<string, unknown>;

  const email = normalizeEmail(body.email);
  if (!email) {
    return { ok: false, status: 400, body: 'invalid email in raw_payload', insertedId: null, terminal: true };
  }

  if (!isValidConstitution(body.constitution_type)) {
    return { ok: false, status: 400, body: 'invalid constitution_type in raw_payload', insertedId: null, terminal: true };
  }
  const constitution_type = (body.constitution_type as string).trim();

  const insertPayload = {
    email,
    first_name: normalizeOptionalString(body.first_name, 100),
    constitution_type,
    constitution_name: normalizeOptionalString(body.constitution_name, 200),
    constitution_nickname: normalizeOptionalString(body.constitution_nickname, 200),
    // completed_at = replay time (not received_at) on purpose: nurture timing keys off it.
    completed_at: new Date().toISOString(),
    purchased_course: false,
    purchased_guide: false,
  };

  const res = await pgrstFetch(`${SUPABASE_URL}/rest/v1/quiz_completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(insertPayload),
  });

  // v3: 409 = row already exists from another path (UNIQUE on lower(email)
  // added in parallel work). Treat as resolved instead of looping forever.
  if (res.status === 409) {
    return { ok: true, status: 200, body: 'already-recorded', insertedId: null, terminal: false };
  }

  const txt = await res.text().catch(() => '');
  let insertedId: string | null = null;
  if (res.ok) {
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed) && parsed[0]?.id) {
        insertedId = String(parsed[0].id);
      }
    } catch {
      // ignore
    }
  }
  return { ok: res.ok, status: res.status, body: txt, insertedId, terminal: false };
}

async function markResolved(
  rowId: string,
  retryStatus: number,
  insertedId: string | null,
  retryCount: number,
): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/quiz_completion_failures?id=eq.${rowId}`;
  const res = await pgrstFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      resolved_at: new Date().toISOString(),
      resolved_quiz_completion_id: insertedId,
      retry_count: retryCount + 1,
      last_retry_at: new Date().toISOString(),
      last_retry_status: retryStatus,
      last_retry_body: null,
    }),
  });
  if (!res.ok) {
    console.error(`markResolved PATCH failed for row ${rowId}`, await res.text().catch(() => ''));
  }
}

async function markStillFailing(
  rowId: string,
  retryStatus: number,
  retryBody: string,
  retryCount: number,
): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/quiz_completion_failures?id=eq.${rowId}`;
  const res = await pgrstFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      retry_count: retryCount + 1,
      last_retry_at: new Date().toISOString(),
      last_retry_status: retryStatus,
      last_retry_body: retryBody.slice(0, 4000),
    }),
  });
  if (!res.ok) {
    console.error(`markStillFailing PATCH failed for row ${rowId}`, await res.text().catch(() => ''));
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('replay-quiz-completion-failures: missing env vars');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Internal cron worker: only the service role (via the Vercel cron) may invoke.
  // Runs at verify_jwt=true, so the gateway has validated the JWT signature; we
  // additionally require role=service_role so the public anon key cannot trigger it.
  if (!isServiceRoleRequest(req)) return serviceRoleRequired();

  const result: DrainResult = { processed: 0, resolved: 0, still_failing: 0, errors: [] };

  try {
    const batch = await fetchPendingBatch();
    if (batch.length === 0) {
      return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    for (const row of batch) {
      result.processed++;
      try {
        const replay = await replayInsert(row);
        if (replay.ok) {
          await markResolved(row.id, replay.status, replay.insertedId, row.retry_count);
          result.resolved++;
          console.log(`replay-quiz-completion-failures: resolved row=${row.id} as quiz_completion=${replay.insertedId ?? 'already-recorded'}`);
        } else if (replay.terminal) {
          // retry_count lands at MAX_REPLAY_ATTEMPTS, so the row drops out of the batch filter.
          await markStillFailing(row.id, replay.status, replay.body, MAX_REPLAY_ATTEMPTS - 1);
          result.still_failing++;
          console.warn(`replay-quiz-completion-failures: parked row=${row.id} status=${replay.status} (not replayable)`);
        } else {
          await markStillFailing(row.id, replay.status, replay.body, row.retry_count);
          result.still_failing++;
          console.warn(`replay-quiz-completion-failures: still_failing row=${row.id} status=${replay.status}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`row=${row.id}: ${message}`);
        console.error(`replay-quiz-completion-failures: error processing row ${row.id}`, message);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('replay-quiz-completion-failures fatal', message);
    return new Response(JSON.stringify({ error: message, ...result }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
