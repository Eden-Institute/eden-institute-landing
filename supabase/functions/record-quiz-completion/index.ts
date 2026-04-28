// record-quiz-completion — captures one quiz submission into public.quiz_completions.
// Source of truth for constitution-quiz results. Two AFTER INSERT triggers then propagate:
//   1. tg_quiz_completion_sync_constitution → profiles.constitution_type + display_name (v3.33.2),
//      person_profiles.eden_constitution for the user's is_self profile.
//   2. quiz_completions_to_waitlist → waitlist_signups (entry_funnel='quiz_funnel') with metadata.
//
// Architectural rationale:
//   1. quiz_completions has RLS enabled with no policies — anon/authenticated
//      cannot insert directly. Service-role mediation prevents browser-spam
//      writes and centralizes server-side validation.
//   2. Validates constitution_type against the canonical 8 Eden Patterns AND
//      the 8 axis-label shapes (e.g. "Hot / Dry / Tense") that the production
//      marketing-quiz currently writes. The DB column is plain text;
//      src/lib/edenPattern.ts → resolveEdenPattern resolves either shape to
//      a canonical EdenPatternName for personalization.
//   3. Multiple rows per email are intentional. The drip-tracker columns
//      (email_*_sent_at) are per-row, so each quiz attempt gets its own row;
//      the sync trigger guards updates with WHEN OLD IS DISTINCT FROM NEW so
//      drip-only writes do not bounce the constitution.
//   4. Independent of resend-waitlist by design — a user who declines marketing
//      consent must still get their constitution captured, because
//      profiles.constitution_type drives /apothecary personalization after
//      signup. See Locked Decision §0.8 #15.
//
// v3.33.4: switched from `Prefer: return=representation` to `Prefer: return=minimal`
// to eliminate a 502 false-positive failure mode observed in production logs
// (15:18 UTC + 15:26 UTC Apr 28). Symptom: row was successfully inserted
// (visible in DB) but the EF returned 502, blocking the frontend's success
// signal. Root cause hypothesis: PostgREST representation-mode response was
// non-2xx in some edge case despite the underlying INSERT succeeding (possibly
// related to the AFTER triggers or PostgREST's row-return logic on tables
// with RLS-no-policies). The frontend never uses the returned row ID anyway.
// Switching to return=minimal removes the parsing failure surface, the EF
// returns 201/empty-body, status check is binary success/fail, and the EF
// returns { ok: true } regardless. If a richer return is needed later, do an
// explicit SELECT after the INSERT (cleaner separation than the implicit
// PostgREST representation chain).
//
// Mapping cross-reference: any addition to the allowlist below MUST be
// mirrored in src/lib/edenPattern.ts (EDEN_PATTERNS + PATTERN_PROFILES) so
// resolveEdenPattern accepts the new shape end-to-end.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ── Canonical constitution_type allowlist ──
//
// Both shapes are first-class:
//   - Pattern-name shape  (e.g. "The Burning Bowstring")  — what
//     resolveEdenPattern fast-paths to via exact match.
//   - 3-axis label shape  (e.g. "Hot / Dry / Tense")      — what the
//     production marketing quiz currently writes; resolved to a Pattern
//     name via the AXIS_LABEL_TO_PATTERN derivation in edenPattern.ts.
//
// All comparisons are case-insensitive and whitespace-normalized.

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

// ── Email normalization ──
// Mirrors lower(email) pattern used by quiz_completions_lower_email_idx and
// the Phase B sub-task 2 sync trigger.
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

// ── Main handler ──

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

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing env vars');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = normalizeEmail((body as Record<string, unknown>).email);
    if (!email) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isValidConstitution((body as Record<string, unknown>).constitution_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid constitution_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const constitution_type = ((body as Record<string, unknown>).constitution_type as string).trim();
    const first_name = normalizeOptionalString((body as Record<string, unknown>).first_name, 100);
    const constitution_name = normalizeOptionalString((body as Record<string, unknown>).constitution_name, 200);
    const constitution_nickname = normalizeOptionalString((body as Record<string, unknown>).constitution_nickname, 200);

    // ── PostgREST insert (service-role) ──
    // v3.33.4: return=minimal eliminates the 502 false-positive observed in
    // production logs. We don't use the returned row ID anywhere downstream;
    // a 201 No Content response is the correct minimal contract.
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

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/quiz_completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(insertPayload),
    });

    if (!insertRes.ok) {
      // Capture both status and body text for diagnosis. PostgREST returns
      // a JSON error envelope with code/message/hint/details for 4xx/5xx.
      const errText = await insertRes.text().catch(() => '<unreadable response body>');
      console.error('quiz_completions INSERT failed', {
        status: insertRes.status,
        statusText: insertRes.statusText,
        body: errText,
        email,
      });
      return new Response(
        JSON.stringify({
          error: 'Failed to record quiz completion',
          status: insertRes.status,
          detail: errText,
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
    console.error('record-quiz-completion uncaught', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
