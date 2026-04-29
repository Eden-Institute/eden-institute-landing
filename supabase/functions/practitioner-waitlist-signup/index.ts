// practitioner-waitlist-signup — captures Practitioner-tier waitlist intent
// from the bottom-of-Apothecary CTA pair (§8.1.4 PR 4).
//
// Architectural rationale:
//   1. waitlist_signups RLS denies anon + authenticated INSERTs by design
//      (only a SELECT-own policy is enabled). Service-role mediation is the
//      canonical pattern, mirroring record-quiz-completion EF.
//   2. entry_funnel = 'practitioner_waitlist' is the new enum value added in
//      migration 20260429035336. Distinct from 'app_beta' (pre-launch
//      Apothecary access) so Resend audiences segment cleanly.
//   3. Practitioner tier opens at end of 2027 per Lock #3 + #28. This EF
//      records intent now; nurture sequencing is downstream's problem.
//   4. Pattern context (slug + display name) is stored in metadata JSONB,
//      not duplicated as enum or first-class column. Same pattern as
//      record-quiz-completion's metadata propagation.
//
// PostgREST insert uses Prefer: return=minimal — same lesson as
// record-quiz-completion v3.33.4 (avoids 502 false-positive when the row
// inserted but representation-mode response failed to parse).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ── Email normalization (mirrors record-quiz-completion) ──
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

// ── Pattern slug allowlist (canonical 8) ──
const VALID_PATTERN_SLUGS = new Set([
  'burning-bowstring',
  'open-flame',
  'pressure-cooker',
  'overflowing-cup',
  'drawn-bowstring',
  'spent-candle',
  'frozen-knot',
  'still-water',
]);

function normalizePatternSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  return VALID_PATTERN_SLUGS.has(trimmed) ? trimmed : null;
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

    const first_name = normalizeOptionalString(
      (body as Record<string, unknown>).first_name,
      100,
    );
    const pattern_slug = normalizePatternSlug(
      (body as Record<string, unknown>).pattern_slug,
    );
    const pattern_name = normalizeOptionalString(
      (body as Record<string, unknown>).pattern_name,
      200,
    );
    const source_url = normalizeOptionalString(
      (body as Record<string, unknown>).source_url,
      500,
    );

    // ── Build insert payload ──
    // metadata gets the Pattern context (downstream Resend tag-by-pattern).
    // consents stays minimal — explicit opt-in is the form's submit action
    // per Lock #14 (no dark patterns, plain explicit affirmative).
    const metadata: Record<string, unknown> = {
      surface: 'apothecary_bottom_cta_pair',
    };
    if (pattern_slug) metadata.pattern_slug = pattern_slug;
    if (pattern_name) metadata.pattern_name = pattern_name;

    const insertPayload = {
      email,
      first_name,
      entry_funnel: 'practitioner_waitlist',
      entered_at: new Date().toISOString(),
      source_url,
      consents: { practitioner_waitlist: true },
      metadata,
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/waitlist_signups`, {
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
      const errText = await insertRes.text().catch(() => '<unreadable response body>');
      // 23505 = unique violation (email + entry_funnel already on list).
      // Idempotency: the user re-submitting their already-recorded intent
      // is a success state from their perspective; we return 200 ok.
      if (insertRes.status === 409 || /duplicate key|23505/.test(errText)) {
        console.log('practitioner_waitlist already-on-list (idempotent ok)', { email });
        return new Response(
          JSON.stringify({ ok: true, already_on_list: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      console.error('waitlist_signups INSERT failed', {
        status: insertRes.status,
        statusText: insertRes.statusText,
        body: errText,
        email,
      });
      return new Response(
        JSON.stringify({
          error: 'Failed to record waitlist signup',
          status: insertRes.status,
          detail: errText,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('practitioner_waitlist INSERT ok', {
      email,
      pattern_slug,
      status: insertRes.status,
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('practitioner-waitlist-signup uncaught', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
