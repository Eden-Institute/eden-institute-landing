// record-quiz-completion v12 — captures one quiz submission into public.quiz_completions.
// Source of truth for constitution-quiz results. Two AFTER INSERT triggers then propagate:
//   1. tg_quiz_completion_sync_constitution → profiles.constitution_type + display_name (v3.33.2),
//      person_profiles.eden_constitution for the user's is_self profile.
//   2. quiz_completions_to_waitlist → waitlist_signups (entry_funnel='quiz_funnel') with metadata.
//
// v12 (2026-04-29) — Dead-letter recovery for visitor submissions whose database
// INSERT fails. Closes a launch-blocker surfaced by four real-traffic 502s with no
// recoverable payload data.
//
// Behavior:
//   1. Validate as before (same allowlist of Pattern names + axis labels).
//   2. Attempt PostgREST INSERT to quiz_completions.
//   3. On 5xx: ONE immediate retry (handles transient deadlock / connection-pool blips).
//   4. On still-failing (any non-2xx): write the raw payload + diagnostic
//      detail to public.quiz_completion_failures BEFORE returning 502 to the caller.
//      The Vercel-cron-driven replay-quiz-completion-failures EF will replay
//      this row every 30 min until it succeeds.
//   5. If the dead-letter write itself fails, log loudly but still return 502 — the
//      EF never crashes silently.
//
// v11 retained the `Prefer: return=minimal` fix from v3.33.4 (eliminated the
// false-positive 502 path where rows were inserted but EF still 502'd). v12 builds
// on v11 — keep return=minimal, add retry + dead-letter on top.
//
// Architectural rationale (unchanged):
//   - quiz_completions has RLS enabled with no policies — anon/authenticated cannot
//     insert directly. Service-role mediation prevents browser-spam writes and
//     centralizes server-side validation.
//   - Validates against the canonical 8 Eden Patterns AND 8 axis-label shapes.
//     resolveEdenPattern in src/lib/edenPattern.ts resolves either shape.
//   - Independent of resend-waitlist by design — see Locked Decision §0.8 #15.
//
// Mapping cross-reference: any addition to the allowlist below MUST be mirrored in
// src/lib/edenPattern.ts (EDEN_PATTERNS + PATTERN_PROFILES) so resolveEdenPattern
// accepts the new shape end-to-end.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const EDEN_PATTERN_NAMES = [
  'The Burning Bowstring',
  'The Open Flame',
  'The Pressure Cooker',
  'The Overflowing Cup',
  'The Drawn Bowstring',
  'The Spent Candle',
  'The Frozen Knot',
  'The Still Water',
];

const AXIS_LABELS = [
  'Hot / Dry / Tense',
  'Hot / Dry / Relaxed',
  'Hot / Damp / Tense',
  'Hot / Damp / Relaxed',
  'Cold / Dry / Tense',
  'Cold / Dry / Relaxed',
  'Cold / Damp / Tense',
  'Cold / Damp / Relaxed',
];

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

const VALID_CONSTITUTIONS = new Set(
  [...EDEN_PATTERN_NAMES, ...AXIS_LABELS].map(normalizeForCompare),
);

function isValidConstitution(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  if (raw.length === 0 || raw.length > 200) return false;
  return VALID_CONSTITUTIONS.has(normalizeForCompare(raw));
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

// Best-effort dead-letter capture. Never throws. If this itself fails, log loudly
// but let the caller still return 502 — we want the EF to never crash silently.
async function writeDeadLetter(
  rawBody: unknown,
  postgrestStatus: number | null,
  postgrestBody: string | null,
  efErrorMessage: string | null,
): Promise<{ deadLetterId: string | null; deadLetterError: string | null }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { deadLetterId: null, deadLetterError: 'Server env missing — cannot write dead-letter' };
  }
  try {
    const dlRes = await fetch(`${SUPABASE_URL}/rest/v1/quiz_completion_failures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        raw_payload: rawBody ?? {},
        postgrest_status: postgrestStatus,
        postgrest_body: postgrestBody,
        ef_error_message: efErrorMessage,
      }),
    });
    if (!dlRes.ok) {
      const errText = await dlRes.text().catch(() => '<unreadable>');
      console.error('quiz_completion_failures dead-letter write FAILED', {
        status: dlRes.status,
        body: errText,
      });
      return { deadLetterId: null, deadLetterError: `dead-letter status=${dlRes.status} body=${errText}` };
    }
    let id: string | null = null;
    try {
      const parsed = await dlRes.json();
      if (Array.isArray(parsed) && parsed[0]?.id) {
        id = String(parsed[0].id);
      }
    } catch {
      // representation parse fail is non-fatal — row was still inserted (status 201)
    }
    return { deadLetterId: id, deadLetterError: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('quiz_completion_failures dead-letter write THREW', message);
    return { deadLetterId: null, deadLetterError: `dead-letter threw: ${message}` };
  }
}

async function postgrestInsert(payload: Record<string, unknown>): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/quiz_completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let rawBody: unknown = null;

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing env vars');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = rawBody as Record<string, unknown>;

    const email = normalizeEmail(body.email);
    if (!email) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isValidConstitution(body.constitution_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid constitution_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const constitution_type = (body.constitution_type as string).trim();
    const first_name = normalizeOptionalString(body.first_name, 100);
    const constitution_name = normalizeOptionalString(body.constitution_name, 200);
    const constitution_nickname = normalizeOptionalString(body.constitution_nickname, 200);

    const insertPayload = {
      email,
      first_name,
      constitution_type,
      constitution_name,
      constitution_nickname,
      completed_at: new Date().toISOString(),
      purchased_course: false,
      purchased_guide: false,
    };

    // First attempt.
    let insertRes = await postgrestInsert(insertPayload);

    // One retry on 5xx — handles transient deadlock / connection-pool blips.
    if (!insertRes.ok && insertRes.status >= 500 && insertRes.status < 600) {
      console.warn(`quiz_completions INSERT first attempt 5xx (${insertRes.status}) — retrying once`);
      // Brief jitter before retry.
      await new Promise((r) => setTimeout(r, 250));
      insertRes = await postgrestInsert(insertPayload);
    }

    if (!insertRes.ok) {
      const errText = await insertRes.text().catch(() => '<unreadable response body>');
      console.error('quiz_completions INSERT failed (after retry)', {
        status: insertRes.status,
        statusText: insertRes.statusText,
        body: errText,
        email,
      });

      // Dead-letter capture — best-effort, never throws.
      const { deadLetterId, deadLetterError } = await writeDeadLetter(
        rawBody,
        insertRes.status,
        errText,
        null,
      );
      if (deadLetterId) {
        console.log(`quiz_completion_failures captured row=${deadLetterId} for email=${email}`);
      } else {
        console.error('CRITICAL: dead-letter ALSO failed', { email, deadLetterError });
      }

      return new Response(
        JSON.stringify({
          error: 'Failed to record quiz completion — submission was captured for automatic retry',
          status: insertRes.status,
          dead_letter_id: deadLetterId,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('quiz_completions INSERT ok', { email, constitution_type, status: insertRes.status });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('record-quiz-completion uncaught', message);

    // Best-effort dead-letter on uncaught throws too — captures payload-parse-related
    // edge cases that would otherwise be lost.
    if (rawBody) {
      const { deadLetterId } = await writeDeadLetter(rawBody, null, null, message);
      if (deadLetterId) {
        console.log(`quiz_completion_failures captured uncaught throw row=${deadLetterId}`);
      }
    }

    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
