// replay-quiz-completion-failures v1 — cron-driven worker that drains the
// quiz_completion_failures dead-letter queue.
//
// Architecture (mirror of Lock #48 nurture-emails consumer):
//   - Vercel cron POSTs every 30 min to /api/cron/replay-quiz-failures with
//     Authorization: Bearer ${CRON_SECRET}.
//   - That Vercel Edge function forwards the request here with the service-role
//     key. We re-verify CRON_SECRET defensively (defense in depth) and drain.
//
// Drain semantics:
//   - Pull oldest 10 unresolved rows.
//   - For each, replay the original raw_payload through a PostgREST INSERT into
//     quiz_completions.
//   - On 2xx: mark resolved_at + resolved_quiz_completion_id (where derivable),
//     bump retry counters.
//   - On non-2xx: increment retry_count, record last_retry_status + body. Row
//     stays unresolved — next cron tick retries.
//   - Defensive: if a row hits retry_count ≥ 20 (10 hours of retries at 30-min
//     cadence), still retry but leave a note suggesting manual triage.
//
// Auth:
//   - verify_jwt = false on this EF (Supabase platform check disabled).
//   - We enforce CRON_SECRET match in the handler itself — same pattern as
//     nurture-emails. Required to prevent random POSTs from draining the queue.
//
// Lock alignment: Lock #48 producer/consumer pattern (queue + cron-driven sync
// sender) extended to quiz-completion failures. Pairs with Lock #15 (Supabase
// source of truth).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const BATCH_SIZE = 10;

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
    `&order=received_at.asc` +
    `&limit=${BATCH_SIZE}`;
  const res = await fetch(url, {
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

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return null;
  if (trimmed.length > 320) return null;
  return trimmed;
}

function normalizeOptionalString(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLen);
}

async function replayInsert(row: FailureRow): Promise<{
  ok: boolean;
  status: number;
  body: string;
  insertedId: string | null;
}> {
  const payload = row.raw_payload || {};
  const body = payload as Record<string, unknown>;

  // Mirror the v12 EF's normalization. We do NOT re-validate the constitution_type
  // allowlist — if it was valid enough to land in dead-letter, we trust it. If
  // the underlying schema rejects it now, that surfaces as a non-2xx and the row
  // stays unresolved.
  const email = normalizeEmail(body.email);
  if (!email) {
    return { ok: false, status: 400, body: 'invalid email in raw_payload', insertedId: null };
  }

  const constitution_type =
    typeof body.constitution_type === 'string' ? body.constitution_type.trim() : null;
  if (!constitution_type) {
    return { ok: false, status: 400, body: 'missing constitution_type in raw_payload', insertedId: null };
  }

  const insertPayload = {
    email,
    first_name: normalizeOptionalString(body.first_name, 100),
    constitution_type,
    constitution_name: normalizeOptionalString(body.constitution_name, 200),
    constitution_nickname: normalizeOptionalString(body.constitution_nickname, 200),
    completed_at: new Date().toISOString(),
    purchased_course: false,
    purchased_guide: false,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/quiz_completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(insertPayload),
  });

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
  return { ok: res.ok, status: res.status, body: txt, insertedId };
}

async function markResolved(
  rowId: string,
  retryStatus: number,
  insertedId: string | null,
  retryCount: number,
): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/quiz_completion_failures?id=eq.${rowId}`;
  const res = await fetch(url, {
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
  const res = await fetch(url, {
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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CRON_SECRET) {
    console.error('replay-quiz-completion-failures: missing env vars');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn('replay-quiz-completion-failures: unauthorized invocation attempt');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
          console.log(`replay-quiz-completion-failures: resolved row=${row.id} as quiz_completion=${replay.insertedId}`);
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
