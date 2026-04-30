// record-quiz-completion v13 — captures one quiz submission into public.quiz_completions.
//
// v13 (2026-04-29): EXTEND the validation allowlist to also accept kebab-case slugs
// (e.g. 'pressure-cooker', 'frozen-knot'). v12 only accepted Pattern names
// ("The Pressure Cooker") and axis labels ("Hot / Damp / Tense"); but production data
// + resend-waitlist's internal normalization both use kebab-case. v12's strict
// rejection of kebab-case was a brittle compatibility gap masked by the frontend's
// silent error swallow on the secondary record-quiz-completion call. v13 closes the
// gap by accepting all three canonical shapes the system uses.
//
// Allowlist v13 covers (case-insensitive, whitespace-normalized):
//   - 8 Pattern names ("The Burning Bowstring", ...)
//   - 8 axis labels ("Hot / Dry / Tense", ...)
//   - 8 kebab-case slugs ("burning-bowstring", "open-flame", "pressure-cooker",
//     "overflowing-cup", "drawn-bowstring", "spent-candle", "frozen-knot",
//     "still-water")
//
// Architectural note: the deeper redundancy (resend-waitlist ALSO writes
// quiz_completions, with kebab-case) is acknowledged but not addressed here.
// Single-canonical-writer cleanup is queued for post-launch §8.2. v13 is the
// surgical fix that eliminates the silent-failure mode without changing the
// dual-write architecture; duplicate-row tolerability holds because all
// downstream side effects (quiz_completions_to_waitlist trigger ON CONFLICT,
// tg_quiz_completion_sync_constitution UPDATE) are idempotent.
//
// All v12 behavior preserved: one retry on PostgREST 5xx, then dead-letter
// capture to public.quiz_completion_failures (Lock #52) before returning 502.

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

// v13: kebab-case slugs that resend-waitlist + production data already use.
const KEBAB_SLUGS = [
  'burning-bowstring',
  'open-flame',
  'pressure-cooker',
  'overflowing-cup',
  'drawn-bowstring',
  'spent-candle',
  'frozen-knot',
  'still-water',
];

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

const VALID_CONSTITUTIONS = new Set(
  [...EDEN_PATTERN_NAMES, ...AXIS_LABELS, ...KEBAB_SLUGS].map(normalizeForCompare),
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
      console.error('quiz_completion_failures dead-letter write FAILED', { status: dlRes.status, body: errText });
      return { deadLetterId: null, deadLetterError: `dead-letter status=${dlRes.status} body=${errText}` };
    }
    let id: string | null = null;
    try {
      const parsed = await dlRes.json();
      if (Array.isArray(parsed) && parsed[0]?.id) {
        id = String(parsed[0].id);
      }
    } catch {}
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
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Invalid constitution_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    let insertRes = await postgrestInsert(insertPayload);

    if (!insertRes.ok && insertRes.status >= 500 && insertRes.status < 600) {
      console.warn(`quiz_completions INSERT first attempt 5xx (${insertRes.status}) — retrying once`);
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
      const { deadLetterId, deadLetterError } = await writeDeadLetter(rawBody, insertRes.status, errText, null);
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

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('record-quiz-completion uncaught', message);
    if (rawBody) {
      const { deadLetterId } = await writeDeadLetter(rawBody, null, null, message);
      if (deadLetterId) {
        console.log(`quiz_completion_failures captured uncaught throw row=${deadLetterId}`);
      }
    }
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
