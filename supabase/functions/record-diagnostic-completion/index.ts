// supabase/functions/record-diagnostic-completion/index.ts
// Eden Apothecary — id-keyed clinical-reading write surface (Lock #40).
// Auth: requires logged-in Supabase user (JWT in Authorization header).
//
// Architectural posture (per Manual §0.8 #37, #38, #40, #41, #42 — v3.16):
//
//   • SOLE write surface for diagnostic_completions. The authenticated role
//     no longer has direct INSERT privilege on that table (Lock #41); this
//     EF performs the insert with the service-role key after validating
//     ownership against the caller's JWT. The dual posture is:
//       - userClient (anon key + JWT) → auth.getUser()
//       - service-role REST → ownership SELECT + INSERT + post-insert read
//     Closes the cross-user write hole that direct PostgREST would leave.
//
//   • Layered diagnostic stack per Lock #37:
//       Layer 1 — Eden Pattern         (eden_constitution)         all authed tiers
//       Layer 2 — Galenic Temperament  (galenic_temperament)       Root
//       Layer 3 — Tissue State Profile (tissue_state_profile JSON) Root, junction storage
//       Layer 4 — Vital Force Reading  (vital_force_reading)       Root
//     Each layer is INDEPENDENTLY OPTIONAL; partial calls are valid.
//
//   • Trigger fan-out behavior (recompiled in 20260426143000_diagnostic_contract_hardening):
//       - Layers 1, 2, 4 + completed_at: COALESCE-fan into person_profiles.
//         Partial calls preserve unspecified columns.
//       - Layer 3 (tissue_state_profile JSONB → person_profile_tissue_states
//         junction): UPSERT-per-pair (additive). Partial Layer-3 payloads
//         preserve unrelated body-system rows. Per Lock #42.
//
//   • Lock #38 citation provenance: every junction row carries completion_id
//     pointing at the diagnostic_completions row that established it. The
//     EF echoes the new completion id back in the response so the frontend
//     can label provenance honestly.
//
//   • Quiz-version namespace per Lock #40 strict separation:
//       - v1            → quiz_completions (marketing pipeline)  — REJECTED here
//       - v1-diagnostic → in-app 12-q diagnostic                  — accepted (default)
//       - v2-deep       → Root 40-q deep diagnostic               — accepted
//
//   • CORS: narrowed to the production allowlist (eden-institute-landing
//     web + Vercel previews). Unknown origins receive no header.
//
//   • Error contract: every failure is mapped through ./errorMap.ts to a
//     stable { code, message } shape. Raw DB error text NEVER leaks.
//
// Payload (POST JSON):
//   {
//     personProfileId: uuid,                    // REQUIRED
//     edenConstitution?: string,                // Layer 1
//     galenicTemperament?: string,              // Layer 2
//     vitalForceReading?: string,               // Layer 4
//     tissueStateProfile?: Record<string,string>,// Layer 3: body_system_id -> tissue_state_id map (jsonb)
//     quizVersion?: "v1-diagnostic" | "v2-deep" // default: "v1-diagnostic"
//   }
// At least ONE clinical layer must be present. Otherwise 400 no_layer_present.
//
// Returns 200:
//   { ok: true, completion_id, person_profile: {...}|null, source }
// where `source` is the wire-stable provenance string for the supplied
// quizVersion (per Lock #38, threaded through the frontend's
// useDiagnosticProfile via diagnosticSource.ts).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeMultiFramework,
  deriveGalenicTemperament,
  deriveVitalForce,
  type EngineResult,
  type Population,
} from "../_shared/multi-framework-engine.ts";
import {
  diagnosticError,
  mapPostgrestError,
  type DiagnosticError,
} from "./errorMap.ts";

// ── env ──
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// ── CORS allowlist (Lock #41 / audit Minor #9) ──
// Only echo Access-Control-Allow-Origin when the request Origin matches.
// Unknown origins: omit the header — browser blocks the response.
//
//   • https://edeninstitute.health           — production
//   • https://eden-institute-landing.vercel.app — canonical Vercel project URL
//   • https://eden-institute-landing-*.vercel.app — PR/preview deploys
//
// Capacitor wrap (post-launch per project_mobile_wrapping_roadmap.md) will
// add capacitor://localhost when the mobile shell ships — extend the regex
// at that time.
const CORS_ORIGIN_RE =
  /^https:\/\/(edeninstitute\.health|eden-institute-landing(-[a-z0-9-]+)?\.vercel\.app)$/i;

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && CORS_ORIGIN_RE.test(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// ── Layer 1 (Eden Pattern) canonical accept set ──
// person_profiles.eden_constitution and profiles.constitution_type both
// store the snake-case the_* slug form (e.g. "the_burning_bowstring").
// Three input forms accepted; mirrors record-quiz-completion's accept logic.
const PATTERN_TABLE: Array<{ slug: string; name: string; axis: string }> = [
  { slug: "the_burning_bowstring", name: "The Burning Bowstring", axis: "Hot / Dry / Tense" },
  { slug: "the_open_flame",        name: "The Open Flame",        axis: "Hot / Dry / Relaxed" },
  { slug: "the_pressure_cooker",   name: "The Pressure Cooker",   axis: "Hot / Damp / Tense" },
  { slug: "the_overflowing_cup",   name: "The Overflowing Cup",   axis: "Hot / Damp / Relaxed" },
  { slug: "the_drawn_bowstring",   name: "The Drawn Bowstring",   axis: "Cold / Dry / Tense" },
  { slug: "the_spent_candle",      name: "The Spent Candle",      axis: "Cold / Dry / Relaxed" },
  { slug: "the_frozen_knot",       name: "The Frozen Knot",       axis: "Cold / Damp / Tense" },
  { slug: "the_still_water",       name: "The Still Water",       axis: "Cold / Damp / Relaxed" },
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

function validateTissueStateProfile(
  raw: unknown,
): { ok: true; value: unknown } | { ok: false } {
  // Layer 3 wire shape per Lock #37 + Lock #42: a Record<body_system_id, tissue_state_id>.
  // The trigger consumes this via jsonb_each_text; arrays would be silently
  // accepted here, persisted, then thrown by the trigger as a confusing
  // noncanonical_clinical_value. Reject arrays at the API surface so the
  // client sees an immediate, meaningful invalid_tissue_state_profile.
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "object") return { ok: false };
  if (Array.isArray(raw)) return { ok: false };
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || typeof v !== "string") return { ok: false };
  }
  return { ok: true, value: raw };
}

// ── Quiz version allowlist (Lock #40 / audit Major #5) ──
const ALLOWED_QUIZ_VERSIONS = new Set<string>(["v1-diagnostic", "v2-deep", "mf-v1"]);
const DEFAULT_QUIZ_VERSION = "v1-diagnostic";

// ── Provenance string per quiz_version (mirrors src/lib/diagnosticSource.ts) ──
const SOURCE_BY_QUIZ_VERSION: Record<string, string> = {
  "v1-diagnostic": "in_app_diagnostic_12q",
  "v2-deep": "deep_diagnostic_40q",
  "mf-v1": "in_app_multiframework_42q",
};

// ── Phase 2: multi-framework assessment support (PD-5…PD-8, PD-12, TL-4) ──

const POPULATIONS = new Set<string>(["adult", "child", "pregnancy", "elderly"]);
const FRAMEWORKS = new Set<string>(["eden", "western", "ayurveda", "tcm"]);

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function fetchQuizBank(version: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quiz_banks?version=eq.${encodeURIComponent(version)}&select=bank`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return rows?.[0]?.bank ?? null;
}

async function fetchEdenSlugMap(): Promise<Record<string, string>> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/eden_patterns?select=pattern_id,slug`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return {};
  const rows = (await res.json().catch(() => [])) as Array<{ pattern_id: string; slug: string }>;
  return Object.fromEntries(rows.map((r) => [r.pattern_id, r.slug]));
}

function validateRawResponses(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0 || entries.length > 200) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of entries) {
    if (typeof k !== "string" || k.length > 12) return null;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 9) return null;
    out[k] = v;
  }
  return out;
}

interface OverrideInput {
  framework: string;
  pattern_id: string;
  role: string;
  note: string | null;
}

function validateOverrides(raw: unknown): OverrideInput[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 8) return null;
  const out: OverrideInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const framework = typeof o.framework === "string" ? o.framework : "";
    const patternId = typeof o.pattern_id === "string" ? o.pattern_id.trim() : "";
    const role = typeof o.role === "string" ? o.role : "primary";
    if (!FRAMEWORKS.has(framework) || !patternId || patternId.length > 20) return null;
    if (role !== "primary" && role !== "secondary") return null;
    const note = typeof o.note === "string" && o.note.trim()
      ? o.note.trim().slice(0, 1000)
      : null;
    out.push({ framework, pattern_id: patternId, role, note });
  }
  return out;
}

// Fan the computed readings into person_profile_constitutions (TL-2).
// Computed rows are replaced wholesale per completion; adjusted rows (PD-8
// practitioner overrides) are NEVER touched by a recompute.
async function fanOutComputedReadings(
  personProfileId: string,
  completionId: string | null,
  result: EngineResult,
): Promise<string | null> {
  const del = await fetch(
    `${SUPABASE_URL}/rest/v1/person_profile_constitutions?person_profile_id=eq.${personProfileId}&reading_kind=eq.computed`,
    { method: "DELETE", headers: serviceHeaders() },
  );
  if (!del.ok) return `delete failed: ${del.status}`;

  const rows: Record<string, unknown>[] = [];
  for (const [framework, reading] of Object.entries(result.frameworks)) {
    for (const role of ["primary", "secondary"] as const) {
      const p = reading[role];
      if (!p) continue;
      rows.push({
        person_profile_id: personProfileId,
        framework,
        pattern_id: p.pattern_id,
        role,
        reading_kind: "computed",
        score: p.score,
        confidence: p.confidence,
        completion_id: completionId,
      });
    }
  }
  if (rows.length === 0) return null;
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/person_profile_constitutions`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(rows),
  });
  if (!ins.ok) return `insert failed: ${ins.status} ${await ins.text().catch(() => "")}`;
  return null;
}

// PD-8: practitioner override — stored ALONGSIDE the computed reading.
async function upsertAdjustedReadings(
  personProfileId: string,
  completionId: string | null,
  overrides: OverrideInput[],
  adjustedBy: string,
): Promise<string | null> {
  for (const o of overrides) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/person_profile_constitutions?on_conflict=person_profile_id,framework,role,reading_kind`,
      {
        method: "POST",
        headers: serviceHeaders({
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        }),
        body: JSON.stringify({
          person_profile_id: personProfileId,
          framework: o.framework,
          pattern_id: o.pattern_id,
          role: o.role,
          reading_kind: "adjusted",
          completion_id: completionId,
          adjusted_by: adjustedBy,
          adjustment_note: o.note,
        }),
      },
    );
    if (!res.ok) {
      return `override ${o.framework}/${o.pattern_id}: ${res.status} ${await res.text().catch(() => "")}`;
    }
  }
  return null;
}

// ── Helpers ──
function jsonResponse(
  body: unknown,
  status: number,
  req: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function errorResponse(
  err: { body: { error: DiagnosticError }; status: number },
  req: Request,
): Response {
  return jsonResponse(err.body, err.status, req);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return errorResponse(diagnosticError("method_not_allowed"), req);
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[record-diagnostic-completion] missing env vars");
      return errorResponse(diagnosticError("server_misconfigured"), req);
    }

    // 1. Authenticate via JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(diagnosticError("missing_authorization"), req);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return errorResponse(diagnosticError("invalid_session"), req);
    }

    // 2. Parse + validate payload shape.
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse(diagnosticError("invalid_json_body"), req);
    }
    const b = body as Record<string, unknown>;

    // ── Phase 2 recompute path (Lock #37: version-bump recompute from stored
    //    raw_responses). {recompute:true, completionId} — ownership enforced
    //    through the completion's person_profile.
    if (b.recompute === true) {
      const completionId = typeof b.completionId === "string" ? b.completionId.trim() : "";
      if (!UUID_RE.test(completionId)) {
        return errorResponse(diagnosticError("invalid_json_body"), req);
      }
      const compRes = await fetch(
        `${SUPABASE_URL}/rest/v1/diagnostic_completions?id=eq.${completionId}&select=id,user_id,person_profile_id,quiz_version,raw_responses`,
        { headers: serviceHeaders() },
      );
      const compRows = compRes.ok ? await compRes.json().catch(() => []) : [];
      const comp = compRows?.[0];
      if (!comp) return errorResponse(diagnosticError("profile_not_found"), req);
      if (comp.user_id !== user.id) return errorResponse(diagnosticError("profile_not_owned"), req);
      const stored = comp.raw_responses ?? {};
      const responses = validateRawResponses(stored.responses);
      if (!responses) return errorResponse(diagnosticError("invalid_json_body"), req);
      const targetVersion = typeof b.targetQuizVersion === "string"
          && ALLOWED_QUIZ_VERSIONS.has(b.targetQuizVersion)
        ? b.targetQuizVersion
        : comp.quiz_version;
      const bank = await fetchQuizBank(targetVersion);
      if (!bank) return errorResponse(diagnosticError("internal_error"), req);
      const population = (POPULATIONS.has(stored.population) ? stored.population : "adult") as Population;
      const result = computeMultiFramework(bank, responses, population);
      const slugMap = await fetchEdenSlugMap();
      const edenPrimary = result.frameworks.eden.primary;
      const patch = {
        quiz_version: targetVersion,
        temperature_score: result.axes.temperature.score,
        moisture_score: result.axes.moisture.score,
        tone_score: result.axes.tone.score,
        axis_confidence: result.axes,
        framework_readings: { frameworks: result.frameworks, disagreements: result.disagreements, dimensions: result.dimensions },
        eden_constitution: edenPrimary ? slugMap[edenPrimary.pattern_id] ?? null : null,
        galenic_temperament: deriveGalenicTemperament(result.axes),
        vital_force_reading: deriveVitalForce(result.dimensions),
      };
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/diagnostic_completions?id=eq.${completionId}`,
        {
          method: "PATCH",
          headers: serviceHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(patch),
        },
      );
      if (!patchRes.ok) return errorResponse(diagnosticError("internal_error"), req);
      const fanErr = await fanOutComputedReadings(comp.person_profile_id, completionId, result);
      if (fanErr) console.error("[record-diagnostic-completion] recompute fan-out", fanErr);
      return jsonResponse(
        { ok: true, completion_id: completionId, recomputed: true, quiz_version: targetVersion, readings: result },
        200,
        req,
      );
    }

    const personProfileId =
      typeof b.personProfileId === "string" ? b.personProfileId.trim() : "";
    if (!UUID_RE.test(personProfileId)) {
      return errorResponse(diagnosticError("invalid_person_profile_id"), req);
    }

    // 2a. Layer 1 — Eden Pattern.
    let edenConstitution: string | null = null;
    if (b.edenConstitution !== undefined && b.edenConstitution !== null) {
      const norm = normalizeEdenConstitution(b.edenConstitution);
      if (norm === null) {
        return errorResponse(diagnosticError("invalid_eden_constitution"), req);
      }
      edenConstitution = norm;
    }

    // 2b. Layer 2 — Galenic temperament.
    const galenicResult = normalizeOptionalText(b.galenicTemperament, 100);
    if (galenicResult === "INVALID") {
      return errorResponse(diagnosticError("invalid_galenic_temperament"), req);
    }
    let galenicTemperament: string | null = galenicResult;

    // 2c. Layer 4 — vital force reading. (Per Lock #37 layer numbering.)
    const vitalResult = normalizeOptionalText(b.vitalForceReading, 100);
    if (vitalResult === "INVALID") {
      return errorResponse(diagnosticError("invalid_vital_force_reading"), req);
    }
    let vitalForceReading: string | null = vitalResult;

    // 2d. Layer 3 — tissue state profile (JSONB shape; trigger UPSERTs into junction).
    const tspCheck = validateTissueStateProfile(b.tissueStateProfile);
    if (!tspCheck.ok) {
      return errorResponse(diagnosticError("invalid_tissue_state_profile"), req);
    }
    const tissueStateProfile = tspCheck.value;

    // 2e. Quiz version (Lock #40 strict separation).
    let quizVersion: string;
    if (b.quizVersion === undefined || b.quizVersion === null) {
      quizVersion = DEFAULT_QUIZ_VERSION;
    } else if (typeof b.quizVersion !== "string"
               || !ALLOWED_QUIZ_VERSIONS.has(b.quizVersion)) {
      return errorResponse(diagnosticError("invalid_quiz_version"), req);
    } else {
      quizVersion = b.quizVersion;
    }

    // 2g. Phase 2 multi-framework inputs (only meaningful for mf-v1).
    const isMultiFramework = quizVersion === "mf-v1";
    let mfResponses: Record<string, number> | null = null;
    if (isMultiFramework && b.rawResponses !== undefined && b.rawResponses !== null) {
      mfResponses = validateRawResponses(b.rawResponses);
      if (!mfResponses) return errorResponse(diagnosticError("invalid_json_body"), req);
    }
    const mfPopulation = (typeof b.population === "string" && POPULATIONS.has(b.population)
      ? b.population
      : "adult") as Population;
    const administeredBy = b.administeredBy === "practitioner" ? "practitioner" : "self"; // PD-7 dual administration
    const overrides = validateOverrides(b.overrides);
    if (overrides === null) return errorResponse(diagnosticError("invalid_json_body"), req);
    if (overrides.length > 0 && administeredBy !== "practitioner") {
      // PD-8: overrides are a practitioner affordance.
      return errorResponse(diagnosticError("invalid_json_body"), req);
    }

    // 2f. Require at least one layer present (a multi-framework submission or
    //     a standalone override batch counts as its own layer source).
    const anyLayerPresent =
      edenConstitution !== null ||
      galenicTemperament !== null ||
      vitalForceReading !== null ||
      tissueStateProfile !== null ||
      mfResponses !== null ||
      overrides.length > 0;
    if (!anyLayerPresent) {
      return errorResponse(diagnosticError("no_layer_present"), req);
    }

    // 3. Verify caller owns the supplied personProfileId.
    //    Service-role read so we get a precise 403/404 distinction; RLS would
    //    occlude as empty result.
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
        "[record-diagnostic-completion] ownership read failed",
        { status: ownerCheckRes.status, text, user_id: user.id, personProfileId },
      );
      return errorResponse(diagnosticError("profile_lookup_failed"), req);
    }
    const ownerRows = (await ownerCheckRes.json()) as Array<{
      id: string;
      user_id: string;
      name: string;
    }>;
    if (ownerRows.length === 0) {
      return errorResponse(diagnosticError("profile_not_found"), req);
    }
    if (ownerRows[0].user_id !== user.id) {
      return errorResponse(diagnosticError("profile_not_owned"), req);
    }

    // 3b. Phase 2 compute: bank-driven engine turns raw responses into all
    //     four framework readings (PD-5). Computed values populate the same
    //     completion row; Lock #39 posture — a balanced axis yields NULL
    //     eden_constitution, never a forced Pattern.
    let mfResult: EngineResult | null = null;
    if (mfResponses) {
      const bank = await fetchQuizBank(quizVersion);
      if (!bank) {
        console.error("[record-diagnostic-completion] quiz bank missing", { quizVersion });
        return errorResponse(diagnosticError("internal_error"), req);
      }
      mfResult = computeMultiFramework(bank, mfResponses, mfPopulation);
      const slugMap = await fetchEdenSlugMap();
      const edenPrimary = mfResult.frameworks.eden.primary;
      if (edenConstitution === null && edenPrimary) {
        edenConstitution = slugMap[edenPrimary.pattern_id] ?? null;
      }
      if (galenicTemperament === null) {
        galenicTemperament = deriveGalenicTemperament(mfResult.axes);
      }
      if (vitalForceReading === null) {
        vitalForceReading = deriveVitalForce(mfResult.dimensions);
      }
    }

    // 4. Insert into diagnostic_completions (service-role, single-write-surface
    //    per Lock #41). Trigger fans into person_profiles + junction.
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      person_profile_id: personProfileId,
      quiz_version: quizVersion,
    };
    if (mfResult && mfResponses) {
      insertPayload.raw_responses = {
        responses: mfResponses,
        population: mfPopulation,
        administered_by: administeredBy,
      };
      insertPayload.temperature_score = mfResult.axes.temperature.score;
      insertPayload.moisture_score = mfResult.axes.moisture.score;
      insertPayload.tone_score = mfResult.axes.tone.score;
      insertPayload.axis_confidence = mfResult.axes;
      insertPayload.framework_readings = {
        frameworks: mfResult.frameworks,
        disagreements: mfResult.disagreements,
        dimensions: mfResult.dimensions,
      };
    }
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
      const mapped = mapPostgrestError(
        insertRes.status,
        errText,
        "diagnostic_completions insert",
      );
      return errorResponse(mapped, req);
    }

    const insertedRows = await insertRes.json();
    const completion = Array.isArray(insertedRows)
      ? insertedRows[0]
      : insertedRows;
    console.log(
      "[record-diagnostic-completion] insert ok",
      {
        user_id: user.id,
        person_profile_id: personProfileId,
        completion_id: completion?.id,
        quiz_version: quizVersion,
        layers: {
          eden: edenConstitution !== null,
          galenic: galenicTemperament !== null,
          tissue: tissueStateProfile !== null,
          vital: vitalForceReading !== null,
        },
      },
    );

    // 4b. Phase 2 fan-out (TL-2): computed readings into
    //     person_profile_constitutions, then any practitioner overrides as
    //     adjusted rows ALONGSIDE the computed ones (PD-8).
    if (mfResult) {
      const fanErr = await fanOutComputedReadings(
        personProfileId,
        completion?.id ?? null,
        mfResult,
      );
      if (fanErr) {
        console.error("[record-diagnostic-completion] fan-out failed", fanErr);
      }
    }
    if (overrides.length > 0) {
      const ovErr = await upsertAdjustedReadings(
        personProfileId,
        completion?.id ?? null,
        overrides,
        user.id,
      );
      if (ovErr) {
        console.error("[record-diagnostic-completion] override write failed", ovErr);
        return errorResponse(diagnosticError("internal_error"), req);
      }
    }

    // 5. Re-read person_profile post-trigger so the caller can rerender from
    //    the COALESCE'd state without a second round-trip. Junction rows
    //    (Layer 3) live in person_profile_tissue_states; consumers that need
    //    Layer 3 read diagnostic_profile_v separately.
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
        "[record-diagnostic-completion] post-insert profile read failed",
        { status: profileRes.status, text, completion_id: completion?.id },
      );
      // Insert succeeded; trigger ran. Don't fail the call — return ok with
      // null person_profile and a soft warning code so the UI can refetch.
      return jsonResponse(
        {
          ok: true,
          completion_id: completion?.id ?? null,
          person_profile: null,
          source: SOURCE_BY_QUIZ_VERSION[quizVersion] ?? "in_app_diagnostic_12q",
          quiz_version: quizVersion,
          warning: { code: "post_insert_read_failed", message: "Completion recorded; profile re-read failed. Please refresh." },
        },
        200,
        req,
      );
    }
    const profileRows = (await profileRes.json()) as Array<unknown>;
    const personProfile = profileRows[0] ?? null;

    return jsonResponse(
      {
        ok: true,
        completion_id: completion?.id ?? null,
        person_profile: personProfile,
        source: SOURCE_BY_QUIZ_VERSION[quizVersion] ?? "in_app_diagnostic_12q",
        quiz_version: quizVersion,
        ...(mfResult ? { readings: mfResult } : {}),
        ...(overrides.length > 0 ? { overrides_applied: overrides.length } : {}),
      },
      200,
      req,
    );
  } catch (err) {
    console.error("[record-diagnostic-completion] uncaught", err);
    return errorResponse(diagnosticError("internal_error"), req);
  }
});
