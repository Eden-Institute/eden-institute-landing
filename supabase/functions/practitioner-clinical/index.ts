// practitioner-clinical — the sole access surface for the Practitioner
// clinical tier (Phase 3; PD-1, PD-9, TL-3, TL-4).
//
// The clinical schema is not exposed through PostgREST and every clinical
// RPC is service-role-execute only, so this EF is structurally the ONLY path
// to clinical data — the same single-write-surface posture as
// record-diagnostic-completion (Lock #40/#41), extended to reads because the
// payload is HIPAA-adjacent clinical notes.
//
// Gate: JWT required (verify_jwt=true) + subscription_tier='practitioner'
// (tier launched 2026-07-09; founder allowlist retained for support and
// internal verification).
// Ownership: every person_profile touched must belong to the caller (the
// roster IS the caller's person_profiles; the cap trigger enforces 500/1000/
// 2000 by sub-tier).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { allowlistCorsHeaders } from "../_shared/cors-allowlist.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FOUNDER_EMAIL = "hello@edeninstitute.health";

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...allowlistCorsHeaders(req), "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_SOAP_BYTES = 32_000;
const shortStr = (v: unknown, n: number) => (typeof v === "string" && v.length > 0 ? v.slice(0, n) : null);

// clinical_formulary_save casts parts::numeric and sort_order::integer, so a
// malformed item would surface as a 500. Returns null when any item is invalid.
function cleanItems(raw: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const it of raw.slice(0, 40)) {
    if (!it || typeof it !== "object") return null;
    const i = it as Record<string, unknown>;
    const herb_id = shortStr(i.herb_id, 64);
    if (!herb_id) return null;
    if (i.parts != null && !(typeof i.parts === "number" && Number.isFinite(i.parts) && i.parts > 0)) return null;
    if (i.sort_order != null && !Number.isInteger(i.sort_order)) return null;
    out.push({
      herb_id,
      preparation_id: shortStr(i.preparation_id, 64),
      parts: i.parts ?? null,
      unit: shortStr(i.unit, 32),
      note: shortStr(i.note, 500),
      sort_order: i.sort_order ?? null,
    });
  }
  return out;
}

function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rest(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: svcHeaders((init?.headers as Record<string, string>) ?? {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} → ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json().catch(() => null);
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  return await rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

async function ownsProfile(userId: string, personProfileId: string): Promise<boolean> {
  if (!UUID_RE.test(personProfileId)) return false;
  const rows = (await rest(
    `person_profiles?id=eq.${personProfileId}&user_id=eq.${userId}&select=id`,
  )) as unknown[];
  return rows.length === 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: allowlistCorsHeaders(req) });

  try {
    // 1. Auth (dual-client: userClient resolves the JWT; service does the work).
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(req, { error: "unauthorized" }, 401);

    // 2. Scope-of-practice gate: Practitioner tier (or founder, internal).
    const profRows = (await rest(
      `profiles?user_id=eq.${user.id}&select=subscription_tier,email`,
    )) as Array<{ subscription_tier: string; email: string }>;
    const tier = profRows?.[0]?.subscription_tier ?? "free";
    const isFounder = (user.email ?? "").toLowerCase() === FOUNDER_EMAIL;
    if (tier !== "practitioner" && !isFounder) {
      return json(req, { error: "practitioner_tier_required" }, 403);
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") {
      return json(req, { error: "invalid_body" }, 400);
    }
    const action = body.action;

    // ── reference data for the one-screen UI dropdowns ─────────────────────
    if (action === "reference") {
      const [complaints, triggers, eden, western, doshas, tcm, preparations] =
        await Promise.all([
          rest(`complaints?select=complaint_id,complaint_name,acuity,refer_threshold&order=complaint_name`),
          rest(`refer_out_triggers?select=trigger_id,trigger_description,severity,action&order=trigger_id`),
          rest(`eden_patterns?select=pattern_id,slug,name,temperature,moisture,tone&order=pattern_id`),
          rest(`western_temperaments_v?select=constitution_id,name&order=constitution_id`),
          rest(`doshas?select=dosha_id,dosha_name&dosha_id=neq.D00&order=dosha_id`),
          rest(`tcm_patterns?select=pattern_id,pattern_name&order=pattern_id`),
          rest(`preparations?select=prep_id,preparation_name&order=preparation_name`),
        ]);
      return json(req, { complaints, triggers, lenses: { eden, western, ayurveda: doshas, tcm }, preparations });
    }

    // ── roster: the caller's clients with standing readings ────────────────
    if (action === "roster") {
      const clients = (await rest(
        `person_profiles?user_id=eq.${user.id}&select=id,name,date_of_birth,biological_sex,profile_kind,eden_constitution,diagnostic_completed_at&order=name`,
      )) as Array<Record<string, unknown>>;
      // Filter through the person_profiles embed instead of an in.() list of
      // every client id, which grows past gateway URL limits near the cap.
      const readingRows = (await rest(
        `person_profile_constitutions?select=person_profile_id,framework,pattern_id,reading_kind,score,confidence,person_profiles!inner(user_id)&person_profiles.user_id=eq.${user.id}&role=eq.primary`,
      )) as Array<Record<string, unknown>>;
      const readings = readingRows.map(({ person_profiles: _pp, ...r }) => r);
      return json(req, { clients, readings });
    }

    // Everything below operates on one owned profile.
    const personProfileId = typeof body.personProfileId === "string" ? body.personProfileId : "";
    if (action !== "ack_refer_out" && !(await ownsProfile(user.id, personProfileId))) {
      return json(req, { error: "profile_not_owned" }, 403);
    }

    if (action === "client") {
      const [profile, readings, completions, encounters, formularies, tissueStates] = await Promise.all([
        rest(`person_profiles?id=eq.${personProfileId}&select=*`),
        rest(`person_profile_constitutions?person_profile_id=eq.${personProfileId}&select=*&order=framework,role,reading_kind`),
        rest(`diagnostic_completions?person_profile_id=eq.${personProfileId}&select=id,quiz_version,completed_at,temperature_score,moisture_score,tone_score,axis_confidence,framework_readings&order=completed_at.desc&limit=10`),
        rpc("clinical_encounters_for_profile", { p_person_profile_id: personProfileId, p_practitioner: user.id }),
        rpc("clinical_formularies_list", { p_practitioner: user.id, p_person_profile_id: personProfileId }),
        // Multi-system terrain analysis (Lock #37 Layer 3): tissue state per
        // organ system, resolved to display names.
        rest(`person_profile_tissue_states?person_profile_id=eq.${personProfileId}&select=body_system_id,tissue_state_id,recorded_at,updated_at,body_systems(system_name),tissue_states(state_name,description)`),
      ]);
      return json(req, {
        profile: (profile as unknown[])[0] ?? null,
        readings,
        completions,           // newest-first; the UI renders re-take deltas from consecutive rows
        encounters,
        formularies,
        tissue_states: tissueStates,
      });
    }

    if (action === "encounter_save") {
      const soap = body.soap && typeof body.soap === "object" && !Array.isArray(body.soap) ? body.soap : null;
      if (soap && JSON.stringify(soap).length > MAX_SOAP_BYTES) return json(req, { error: "soap_too_large" }, 400);
      const result = await rpc("clinical_encounter_upsert", {
        p_id: typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : null,
        p_practitioner: user.id,
        p_person_profile_id: personProfileId,
        p_chief_complaint_id: shortStr(body.chiefComplaintId, 64),
        p_chief_complaint_text: typeof body.chiefComplaintText === "string" ? body.chiefComplaintText.slice(0, 2000) : null,
        p_pregnant: typeof body.pregnant === "boolean" ? body.pregnant : null,
        p_breastfeeding: typeof body.breastfeeding === "boolean" ? body.breastfeeding : null,
        p_trigger_ids: Array.isArray(body.triggerIds)
          ? body.triggerIds.filter((t) => typeof t === "string").slice(0, 40).map((t) => (t as string).slice(0, 64))
          : null,
        p_soap: soap,
        p_status: body.status === "closed" ? "closed" : null,
      });
      return json(req, { encounter: result });
    }

    if (action === "ack_refer_out") {
      // PD-9: explicit practitioner acknowledgment unblocks the herb list.
      const encounterId = typeof body.encounterId === "string" ? body.encounterId : "";
      if (!UUID_RE.test(encounterId)) return json(req, { error: "invalid_encounter_id" }, 400);
      const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null;
      if (!note) return json(req, { error: "acknowledgment_note_required" }, 400);
      const result = await rpc("clinical_encounter_ack_refer_out", {
        p_id: encounterId, p_practitioner: user.id, p_note: note,
      });
      return json(req, { encounter: result });
    }

    if (action === "pocket") {
      const encounterId = typeof body.encounterId === "string" ? body.encounterId : "";
      if (!UUID_RE.test(encounterId)) return json(req, { error: "invalid_encounter_id" }, 400);
      const result = await rpc("pocket_materia_medica", {
        p_person_profile_id: personProfileId,
        p_encounter_id: encounterId,
        p_framework: typeof body.framework === "string" ? body.framework : null,
        p_pattern_id: typeof body.patternId === "string" ? body.patternId : null,
      });
      return json(req, { pocket: result });
    }

    if (action === "formulary_save") {
      const items = cleanItems(body.items);
      if (items === null) return json(req, { error: "invalid_items" }, 400);
      const result = await rpc("clinical_formulary_save", {
        p_id: typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : null,
        p_practitioner: user.id,
        p_person_profile_id: personProfileId,
        p_name: typeof body.name === "string" ? body.name.slice(0, 200) : "Untitled blend",
        p_notes: typeof body.notes === "string" ? body.notes.slice(0, 4000) : null,
        p_items: items,
      });
      return json(req, { formulary: result });
    }

    if (action === "case_file") {
      const result = await rpc("clinical_case_file", {
        p_person_profile_id: personProfileId, p_practitioner: user.id,
      });
      return json(req, { case_file: result });
    }

    return json(req, { error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[practitioner-clinical]", err instanceof Error ? err.message : err);
    return json(req, { error: "internal_error" }, 500);
  }
});
