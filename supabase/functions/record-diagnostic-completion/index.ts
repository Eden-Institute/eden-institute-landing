// supabase/functions/record-diagnostic-completion/index.ts
// Eden Apothecary — Layer 1+2+3+4 clinical-reading write surface (Lock #40)
// Auth: requires logged-in Supabase user (JWT in Authorization header)
//
// Architectural posture (per Manual §0.8 #40 and v3.14 Session Log):
//   • Single id-keyed write surface for all four diagnostic layers
//     (Eden Pattern · Galenic temperament · vital force overlay · tissue
//     state profile by organ system). Each layer is INDEPENDENTLY OPTIONAL —
//     a Layer-1-only call is valid; a Layer-2/3/4 build-out call is valid.
//   • Writes into public.diagnostic_completions; the
//     tg_diagnostic_completion_sync_profile trigger then fans into
//     public.person_profiles (eden_constitution, galenic_temperament,
//     vital_force_reading, tissue_state_profile via COALESCE so each
//     column is preserved when its layer is omitted from this call).
//   • The marketing pipeline (anon /quiz → record-quiz-completion →
//     quiz_completions, email-keyed) is NOT touched by this function.
//   • Caller MUST own the supplied personProfileId (auth.uid() match
//     against person_profiles.user_id), enforced server-side before insert.
//   • diagnostic_completions.user_id is NOT NULL (caught during the v3.14
//     PR #24 smoke); this function injects user_id from auth.uid().
//
// Payload (POST JSON):
//   {
//     personProfileId: uuid,           // REQUIRED
//     edenConstitution?: string,       // Layer 1 — Pattern of Eden
//     galenicTemperament?: string,     // Layer 2 — Galenic temperament
//     vitalForceReading?: string,      // Layer 3 — vital force overlay
//     tissueStateProfile?: object[]    // Layer 4 — tissue state profile
//   }
// At least ONE clinical layer must be present. Otherwise 400.
//
// Returns 200 { ok: true, person_profile: {...} } with the updated
// person_profiles row (post trigger fan-out) so the caller can
// rerender immediately without a separate read.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── env ──
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Layer-1 (Eden Pattern) canonical accept set ──
// person_profiles.eden_constitution and profiles.constitution_type both
// store the snake-case the_* slug form (e.g. "the_burning_bowstring").
// Three input forms are accepted and normalized to slug server-side
// (mirrors record-quiz-completion's accept logic so callers can pass
// whatever computeResult() produces without front-end-side mapping):
//
//   • slug form         "the_burning_bowstring"
//   • display name      "The Burning Bowstring"
//   • 3-axis label      "Hot / Dry / Tense"  (what computeResult writes)
//
// All comparisons are case-insensitive and whitespace-normalized.
const PATTERN_TABLE: Array<{ slug: string; name: string; axis: string }> = [
  { slug: "the_burning_bowstring",  name: "The Burning Bowstring",  axis: "Hot / Dry / Tense" },
  { slug: "the_open_flame",         name: "The Open Flame",         axis: "Hot / Dry / Relaxed" },
  { slug: "the_pressure_cooker",    name: "The Pressure Cooker",    axis: "Hot / Damp / Tense" },
  { slug: "the_overflowing_cup",    name: "The Overflowing Cup",    axis: "Hot / Damp / Relaxed" },
  { slug: "the_drawn_bowstring",    name: "The Drawn Bowstring",    axis: "Cold / Dry / Tense" },
  { slug: "the_spent_candle",       name: "The Spent Candle",       axis: "Cold / Dry / Relaxed" },
  { slug: "the_frozen_knot",        name: "The Frozen Knot",        axis: "Cold / Damp / Tense" },
  { slug: "the_still_water",        name: "The Still Water",        axis: "Cold / Damp / Relaxed" },
];

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

const FROM_ANY_FORM = new Map<string, string>();
for (const p of PATTERN_TABLE) {
  FROM_ANY_FORM.set(normalizeForCompare(p.slug), p.slug);
  FROM_ANY_FORM.set(normalizeForCompare(p.name), p.slug);
  FROM_ANY_FORM.set(normalizeForCompare(p.axis), p.slug);
}

function normalizeEdenConstitution(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  return FROM_ANY_FORM.get(normalizeForCompare(trimmed)) ?? null;
}

// ── Layer 2/3 lightweight validation ──
// Galenic temperament + vital force overlay are TS-contract-bounded
// in src/lib/galenicTemperament.ts and src/lib/vitalForce.ts.
// Server-side we validate length/shape only; the TS contract is the
// authoring-time gate on canonical strings (Lock #38: every diagnostic
// claim cites a primary text — claim authoring is in TS modules).
function normalizeOptionalText(
  raw: unknown,
  maxLen: number,
): string | null | "INVALID" {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return "INVALID";
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLen) return "INVALID";
  return trimmed;
}

// ── Layer 4 (tissue state profile) shape validation ──
// The DB-level FK trigger trg_pp_tissue_states_enforce_canonical
// (PR #23) is authoritative on clinical_canonical membership.
// Here we only confirm the value is parseable JSON of expected shape:
// either an array of {body_system_id, tissue_state_id} pairs OR an
// object map keyed by body_system_id. We pass through to the JSONB
// column unchanged once shape is sane.
function validateTissueStateProfile(
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "object") {
    return { ok: false, reason: "tissueStateProfile must be object or array" };
  }
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") {
        return { ok: false, reason: "tissueStateProfile array entry malformed" };
      }
      const e = entry as Record<string, unknown>;
      if (typeof e.body_system_id !== "string" ||
          typeof e.tissue_state_id !== "string") {
        return {
          ok: false,
          reason:
            "tissueStateProfile entries require string body_system_id + tissue_state_id",
        };
      }
    }
    return { ok: true, value: raw };
  }
  // Object-map form: keys are body_system_id, values are tissue_state_id strings
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || typeof v !== "string") {
      return {
        ok: false,
        reason: "tissueStateProfile object map must be string→string",
      };
    }
  }
  return { ok: true, value: raw };
}

// ── Helpers ──
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("record-diagnostic-completion: missing env vars");
      return jsonError("Server configuration error", 500);
    }

    // 1. Authenticate the caller via JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("Missing Authorization header", 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonError("Invalid or expired session", 401);
    }

    // 2. Parse + validate payload shape.
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }
    const b = body as Record<string, unknown>;

    const personProfileId =
      typeof b.personProfileId === "string" ? b.personProfileId.trim() : "";
    if (!UUID_RE.test(personProfileId)) {
      return jsonError("Invalid or missing personProfileId", 400);
    }

    // 2a. Layer 1 — Eden Pattern (optional).
    let edenConstitution: string | null = null;
    if (b.edenConstitution !== undefined && b.edenConstitution !== null) {
      const norm = normalizeEdenConstitution(b.edenConstitution);
      if (norm === null) {
        return jsonError("Invalid edenConstitution", 400);
      }
      edenConstitution = norm;
    }

    // 2b. Layer 2 — Galenic temperament (optional, free-form text bounded).
    const galenicResult = normalizeOptionalText(b.galenicTemperament, 100);
    if (galenicResult === "INVALID") {
      return jsonError("Invalid galenicTemperament", 400);
    }
    const galenicTemperament: string | null = galenicResult;

    // 2c. Layer 3 — vital force overlay (optional, bounded).
    const vitalResult = normalizeOptionalText(b.vitalForceReading, 100);
    if (vitalResult === "INVALID") {
      return jsonError("Invalid vitalForceReading", 400);
    }
    const vitalForceReading: string | null = vitalResult;

    // 2d. Layer 4 — tissue state profile (optional, JSONB shape-validated).
    const tspCheck = validateTissueStateProfile(b.tissueStateProfile);
    if (!tspCheck.ok) {
      return jsonError(tspCheck.reason, 400);
    }
    const tissueStateProfile = tspCheck.value;

    // 2e. Require at least one layer present — empty completions are not meaningful.
    const anyLayerPresent =
      edenConstitution !== null ||
      galenicTemperament !== null ||
      vitalForceReading !== null ||
      tissueStateProfile !== null;
    if (!anyLayerPresent) {
      return jsonError(
        "At least one diagnostic layer must be supplied (edenConstitution / galenicTemperament / vitalForceReading / tissueStateProfile)",
        400,
      );
    }

    // 3. Verify caller owns the supplied personProfileId.
    //    Read with service role so RLS does not occlude the integrity check;
    //    we are doing the ownership check in code rather than relying on RLS
    //    of the user-scoped client because we want a precise 403 on mismatch
    //    rather than a generic empty result.
    const ownerCheckRes = await fetch(
      `${SUPABASE_URL}/rest/v1/person_profiles?id=eq.${personProfileId}&select=id,user_id,name`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!ownerCheckRes.ok) {
      const text = await ownerCheckRes.text();
      console.error(
        "record-diagnostic-completion: ownership read failed",
        ownerCheckRes.status,
        text,
      );
      return jsonError("Profile lookup failed", 500);
    }
    const ownerRows = (await ownerCheckRes.json()) as Array<{
      id: string;
      user_id: string;
      name: string;
    }>;
    if (ownerRows.length === 0) {
      return jsonError("Profile not found", 404);
    }
    if (ownerRows[0].user_id !== user.id) {
      return jsonError("Not authorized for this profile", 403);
    }

    // 4. Insert into diagnostic_completions. Trigger fans into person_profiles.
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      person_profile_id: personProfileId,
    };
    if (edenConstitution !== null) {
      insertPayload.eden_constitution = edenConstitution;
    }
    if (galenicTemperament !== null) {
      insertPayload.galenic_temperament = galenicTemperament;
    }
    if (vitalForceReading !== null) {
      insertPayload.vital_force_reading = vitalForceReading;
    }
    if (tissueStateProfile !== null) {
      insertPayload.tissue_state_profile = tissueStateProfile;
    }

    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/diagnostic_completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(insertPayload),
      },
    );

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error(
        "record-diagnostic-completion: insert failed",
        insertRes.status,
        errText,
      );
      // 400 → likely shape validation failure; 422/409 → constraint or trigger
      // failure surfaced from DB (e.g. tissue_state non-canonical via FK trigger).
      const passthrough =
        insertRes.status >= 400 && insertRes.status < 500
          ? insertRes.status
          : 502;
      return jsonResponse(
        { error: "Failed to record diagnostic completion", detail: errText },
        passthrough,
      );
    }

    const insertedRows = await insertRes.json();
    const completion = Array.isArray(insertedRows)
      ? insertedRows[0]
      : insertedRows;
    console.log("record-diagnostic-completion: insert ok", {
      user_id: user.id,
      person_profile_id: personProfileId,
      completion_id: completion?.id,
      layers: {
        eden: edenConstitution !== null,
        galenic: galenicTemperament !== null,
        vital: vitalForceReading !== null,
        tissue: tissueStateProfile !== null,
      },
    });

    // 5. Re-read the person_profile so the caller can rerender from the
    //    post-trigger fan-out state without a second round-trip.
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/person_profiles?id=eq.${personProfileId}&select=*`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!profileRes.ok) {
      const text = await profileRes.text();
      console.error(
        "record-diagnostic-completion: post-insert profile read failed",
        profileRes.status,
        text,
      );
      // Insert succeeded; fan-out trigger ran. Don't fail the call — just
      // return ok without the profile shape so the frontend can re-fetch.
      return jsonResponse(
        { ok: true, completion_id: completion?.id ?? null, person_profile: null },
        200,
      );
    }
    const profileRows = (await profileRes.json()) as Array<unknown>;
    const personProfile = profileRows[0] ?? null;

    return jsonResponse(
      {
        ok: true,
        completion_id: completion?.id ?? null,
        person_profile: personProfile,
      },
      200,
    );
  } catch (err) {
    console.error("record-diagnostic-completion: uncaught", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(message, 500);
  }
});
