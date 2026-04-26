// supabase/functions/record-diagnostic-completion/errorMap.ts
//
// Wire-stable error contract for the record-diagnostic-completion Edge
// Function. Per the v3.16 audit-fix pass: the EF NEVER passes raw Supabase /
// Postgres error text to the client. Every failure is mapped through this
// module to a stable { code, message } shape so:
//
//   • Schema details (constraint names, column names, internal types) do
//     not leak across the API surface.
//   • Frontend code can branch on `code` (a wire-stable string), not on
//     fragile message substrings.
//   • The mapping is the single place to evolve error vocabulary as new
//     failure modes surface (profile cap, deep-quiz validation, etc.).
//
// Also exports the wire response shape and an `unwrap` helper so the EF can
// produce consistent JSON errors at every error site.

/**
 * Wire-stable error code vocabulary.
 *
 * NEVER rename these strings without coordinating with frontend consumers —
 * the Apothecary UI surface branches on these.
 */
export type DiagnosticErrorCode =
  | "missing_authorization"        // 401 — no Authorization header
  | "invalid_session"              // 401 — JWT failed to resolve a user
  | "method_not_allowed"           // 405 — non-POST/OPTIONS
  | "server_misconfigured"         // 500 — env vars missing
  | "invalid_json_body"            // 400 — body did not parse as JSON
  | "invalid_person_profile_id"    // 400 — UUID malformed or missing
  | "invalid_eden_constitution"    // 400 — Layer 1 normalization failed
  | "invalid_galenic_temperament"  // 400 — Layer 2 shape failed
  | "invalid_vital_force_reading"  // 400 — Layer 4 shape failed
  | "invalid_tissue_state_profile" // 400 — Layer 3 shape failed
  | "invalid_quiz_version"         // 400 — outside the allowlist
  | "no_layer_present"             // 400 — empty completion not meaningful
  | "profile_not_found"            // 404 — person_profile_id doesn't exist
  | "profile_not_owned"            // 403 — owned by a different auth.uid()
  | "profile_lookup_failed"        // 500 — ownership query DB error
  | "noncanonical_clinical_value"  // 422 — clinical_canonical FK trigger raised
  | "duplicate_completion"         // 409 — unique violation (defensive)
  | "invalid_reference"            // 422 — FK violation, no schema detail
  | "write_path_disallowed"        // 500 — service-role insert refused (shouldn't happen)
  | "profile_cap_exceeded"         // 422 — forward-compat for tier cap enforcement
  | "post_insert_read_failed"      // 200-with-warning — insert ok, re-read failed
  | "internal_error";              // 500 — fallback

export interface DiagnosticError {
  code: DiagnosticErrorCode;
  message: string;
}

export interface DiagnosticErrorResponse {
  error: DiagnosticError;
}

/**
 * Default human-readable messages keyed by code. The EF uses these unless a
 * call site supplies a more specific message; the frontend may also override
 * per-code with localized / context-specific copy.
 */
const DEFAULT_MESSAGES: Record<DiagnosticErrorCode, string> = {
  missing_authorization:
    "Missing Authorization header.",
  invalid_session:
    "Invalid or expired session.",
  method_not_allowed:
    "Method not allowed.",
  server_misconfigured:
    "Server configuration error.",
  invalid_json_body:
    "Request body must be valid JSON.",
  invalid_person_profile_id:
    "Invalid or missing personProfileId.",
  invalid_eden_constitution:
    "Submitted edenConstitution is not a recognized Pattern of Eden value.",
  invalid_galenic_temperament:
    "Submitted galenicTemperament is not a valid value.",
  invalid_vital_force_reading:
    "Submitted vitalForceReading is not a valid value.",
  invalid_tissue_state_profile:
    "Submitted tissueStateProfile shape is invalid.",
  invalid_quiz_version:
    "quizVersion must be one of the allowed values.",
  no_layer_present:
    "At least one diagnostic layer must be supplied (edenConstitution, galenicTemperament, vitalForceReading, or tissueStateProfile).",
  profile_not_found:
    "Person profile not found.",
  profile_not_owned:
    "You do not have access to that profile.",
  profile_lookup_failed:
    "Profile lookup failed.",
  noncanonical_clinical_value:
    "Submitted body system or tissue state is not a canonical clinical value.",
  duplicate_completion:
    "This diagnostic completion has already been recorded.",
  invalid_reference:
    "Submitted reference value does not exist.",
  write_path_disallowed:
    "Direct writes to this surface are not permitted.",
  profile_cap_exceeded:
    "Profile limit reached for your tier.",
  post_insert_read_failed:
    "Completion recorded; profile re-read failed. Please refresh.",
  internal_error:
    "Failed to record diagnostic completion.",
};

/**
 * HTTP status mapping per code. Centralized so call sites just emit a code
 * and don't need to remember the right HTTP envelope.
 */
const HTTP_STATUS: Record<DiagnosticErrorCode, number> = {
  missing_authorization: 401,
  invalid_session: 401,
  method_not_allowed: 405,
  server_misconfigured: 500,
  invalid_json_body: 400,
  invalid_person_profile_id: 400,
  invalid_eden_constitution: 400,
  invalid_galenic_temperament: 400,
  invalid_vital_force_reading: 400,
  invalid_tissue_state_profile: 400,
  invalid_quiz_version: 400,
  no_layer_present: 400,
  profile_not_found: 404,
  profile_not_owned: 403,
  profile_lookup_failed: 500,
  noncanonical_clinical_value: 422,
  duplicate_completion: 409,
  invalid_reference: 422,
  write_path_disallowed: 500,
  profile_cap_exceeded: 422,
  post_insert_read_failed: 200, // warning-style, not a hard error
  internal_error: 500,
};

/**
 * Build a stable error response body for a known code.
 */
export function diagnosticError(
  code: DiagnosticErrorCode,
  override?: string,
): { body: DiagnosticErrorResponse; status: number } {
  return {
    body: { error: { code, message: override ?? DEFAULT_MESSAGES[code] } },
    status: HTTP_STATUS[code],
  };
}

/**
 * Map a Supabase-PostgREST error response (status code + body text from a
 * failed fetch) to the EF's wire-stable error code. The body text is parsed
 * for known PostgREST shapes (`{ code, message, details, hint }`), then the
 * Postgres SQLSTATE / message is used to pick the diagnostic code.
 *
 * Schema details (constraint names, column names) are inspected internally
 * to pick the right code but are NEVER passed through to the wire response.
 *
 * Logs the full structured error to console.error so observability isn't lost.
 */
export function mapPostgrestError(
  httpStatus: number,
  bodyText: string,
  context: string,
): { body: DiagnosticErrorResponse; status: number } {
  let parsed: { code?: string; message?: string; details?: string; hint?: string } | null = null;
  try {
    parsed = JSON.parse(bodyText) as typeof parsed;
  } catch {
    parsed = null;
  }

  const sqlstate = parsed?.code ?? "";
  const pgMessage = parsed?.message ?? "";

  // Always log the full error server-side for observability — the wire
  // response is intentionally redacted.
  console.error(
    `[record-diagnostic-completion] ${context} failed`,
    {
      httpStatus,
      sqlstate,
      pgMessage,
      details: parsed?.details,
      hint: parsed?.hint,
    },
  );

  // SQLSTATE-driven mapping. P0001 is RAISE EXCEPTION (used by the
  // clinical_canonical FK trigger landed in PR #23 — an attempt to write
  // a non-canonical body_system_id or tissue_state_id into the junction).
  if (sqlstate === "P0001") {
    if (/canonical/i.test(pgMessage)) {
      return diagnosticError("noncanonical_clinical_value");
    }
    return diagnosticError("invalid_reference");
  }

  // 23505 — unique_violation. Defensive: shouldn't happen on
  // diagnostic_completions (no unique constraints other than the PK), but
  // could happen on the junction if the trigger UPSERT logic regressed.
  if (sqlstate === "23505") {
    return diagnosticError("duplicate_completion");
  }

  // 23503 — foreign_key_violation. Most likely cause: invalid
  // person_profile_id or invalid body_system_id / tissue_state_id reference
  // (not caught by the canonical trigger because the dimension row simply
  // doesn't exist).
  if (sqlstate === "23503") {
    return diagnosticError("invalid_reference");
  }

  // 42501 — insufficient_privilege. Only reachable if a future migration
  // accidentally revokes service-role's write privilege; treat as internal.
  if (sqlstate === "42501") {
    return diagnosticError("write_path_disallowed");
  }

  // PostgREST sometimes signals shape failures with 22P02 (invalid_text_representation)
  // or 22023 (invalid_parameter_value) — surface as invalid_reference for now;
  // refine if specific patterns emerge.
  if (sqlstate === "22P02" || sqlstate === "22023") {
    return diagnosticError("invalid_reference");
  }

  // Bucket by HTTP status if we can't resolve via SQLSTATE.
  if (httpStatus === 409) return diagnosticError("duplicate_completion");
  if (httpStatus === 422) return diagnosticError("invalid_reference");
  if (httpStatus === 403) return diagnosticError("profile_not_owned");
  if (httpStatus === 404) return diagnosticError("profile_not_found");

  return diagnosticError("internal_error");
}
