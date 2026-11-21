// wired-pilot: the Wired quiz pilot (W12; spec section 13, answers 11, 33). Public POST, verify_jwt = false.
// DARK twice over: the quiz gate (WIRED_ENABLED or the preview pass, wired-gate.ts) AND the pilot switch
// (secret WIRED_PILOT_OPEN = "true", turned on only after Camila approves the pilot launch). With the switch off
// every action answers 404 { error: "pilot_closed" } unless the request carries the preview pass.
//
//   {action: 'apply', ...form}                 the approved application (one per email; a re-send updates it
//                                              while it is still 'applied'). Rate limited 10 per IP an hour.
//   {action: 'status', token}                  her pilot state: selected?, each child's ladder step, next survey,
//                                              when it opens, whether the retake quiz is due.
//   {action: 'survey', token, child_id, kind, answers}   records a survey and gives its reward.
//   {action: 'retake', token, child_id, bank_version, answers}   the 30-day retake quiz.
//   {action: 'chapter', token, n: 1 | 4}       a fresh 1-hour link to an unlocked advance chapter (private storage,
//                                              _shared/wired-pilot-chapters.ts). status lists the ready ones.
// Tokens are her results token (family id). Only a SELECTED tester can take surveys or the retake.

import { bumpRateBucket, clientIp } from "../_shared/rate-bucket.ts";
import { nextStep, parseApplication, selectedPilot, submitRetake, submitSurvey, SURVEY_ORDER, type SurveyKind } from "../_shared/wired-pilot.ts";
import { cleanAnswers, cleanAttribution } from "../_shared/wired-submit-core.ts";
import { type Db, pg } from "../_shared/wired-submit-flow.ts";
import { availableChapters, signChapter, type ChapterNo } from "../_shared/wired-pilot-chapters.ts";
import { verifyWiredToken } from "../_shared/wired-token.ts";
import { wiredGate, wiredJson, wiredOpen } from "../_shared/wired-gate.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function pilotOpen(req: Request, env: (k: string) => string | undefined = (k) => Deno.env.get(k)): boolean {
  if (env("WIRED_PILOT_OPEN") === "true") return true;
  // Lane 2's checks: a valid preview pass opens the pilot, judged without the quiz switch.
  return wiredOpen(req, (k) => (k === "WIRED_ENABLED" ? undefined : env(k)));
}

Deno.serve(async (req) => {
  const gate = wiredGate(req);
  if (gate) return gate;
  if (req.method !== "POST") return wiredJson(405, { error: "method_not_allowed" });
  if (!pilotOpen(req)) return wiredJson(404, { error: "pilot_closed" });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return wiredJson(400, { error: "body must be JSON" });
  }
  const db: Db = { url: Deno.env.get("SUPABASE_URL") ?? "", key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" };

  try {
    if (body.action === "apply") {
      const ip = clientIp(req);
      const n = ip ? await bumpRateBucket({ supabaseUrl: db.url, serviceKey: db.key, key: `wired_pilot:ip:${ip}`, windowSeconds: 3600 }) : null;
      if ((n ?? 0) > 10) return wiredJson(429, { error: "too_many" });
      const parsed = parseApplication(body);
      if (!parsed.ok) return wiredJson(400, { error: "invalid", fields: parsed.errors });
      const a = parsed.value;
      const existing = (await pg<{ id: string; status: string }[]>(db, `wired_pilot_applications?email=eq.${encodeURIComponent(a.email)}&select=id,status&limit=1`))?.[0];
      const row = { ...a, attribution: cleanAttribution(body.attribution), updated_at: new Date().toISOString() };
      if (!existing) {
        await pg(db, "wired_pilot_applications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
      } else if (existing.status === "applied") {
        await pg(db, `wired_pilot_applications?id=eq.${existing.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
      }
      return wiredJson(200, { ok: true });
    }

    const grant = await verifyWiredToken(body.token, "results");
    if (!grant) return wiredJson(401, { error: "invalid_or_expired_link" });
    const fam = (await pg<{ email: string }[]>(db, `wired_families?id=eq.${grant.familyId}&select=email&limit=1`))?.[0];
    if (!fam) return wiredJson(404, { error: "not_found" });
    const selected = await selectedPilot(db, fam.email);

    if (body.action === "status") {
      if (!selected) return wiredJson(200, { selected: false });
      const kids = (await pg<{ id: string; nickname: string; grade: number }[]>(db,
        `wired_children?family_id=eq.${grant.familyId}&removed_at=is.null&unlocked_via=not.is.null&select=id,nickname,grade&order=created_at.asc`)) ?? [];
      const first = kids[0];
      const chapters = await availableChapters(db, grant.familyId);
      return wiredJson(200, { selected: true, child: first ?? null, chapters, ...(first ? await nextStep(db, grant.familyId, first.id) : { next: "quiz" }) });
    }
    if (!selected) return wiredJson(403, { error: "not_a_selected_tester" });
    if (body.action === "chapter") {
      const n = body.n === 1 || body.n === 4 ? (body.n as ChapterNo) : null;
      if (!n) return wiredJson(400, { error: "n must be 1 or 4" });
      if (!(await availableChapters(db, grant.familyId)).includes(n)) return wiredJson(404, { error: "chapter_not_ready" });
      const url = await signChapter(db, n);
      return url ? wiredJson(200, { url }) : wiredJson(404, { error: "chapter_not_ready" });
    }
    if (typeof body.child_id !== "string" || !UUID_RE.test(body.child_id)) return wiredJson(400, { error: "child_id is required" });
    const kid = (await pg<{ id: string }[]>(db, `wired_children?id=eq.${body.child_id}&family_id=eq.${grant.familyId}&removed_at=is.null&select=id&limit=1`))?.[0];
    if (!kid) return wiredJson(404, { error: "unknown_child" });

    if (body.action === "survey") {
      const kind = body.kind as SurveyKind;
      if (!SURVEY_ORDER.includes(kind)) return wiredJson(400, { error: "kind must be ux, accuracy, family_map or retake" });
      const answers = body.answers && typeof body.answers === "object" ? body.answers as Record<string, unknown> : null;
      if (!answers) return wiredJson(400, { error: "answers are required" });
      const out = await submitSurvey(db, grant.familyId, kid.id, kind, answers);
      if (out.status === "ok" || out.status === "already") return wiredJson(200, out);
      if (out.status === "not_yet") return wiredJson(409, out);
      return wiredJson(400, out);
    }
    if (body.action === "retake") {
      const answers = cleanAnswers(body.answers);
      if (!answers || typeof body.bank_version !== "string") return wiredJson(400, { error: "answers and bank_version are required" });
      const out = await submitRetake(db, grant.familyId, kid.id, body.bank_version, answers);
      return wiredJson(out.status === "ok" || out.status === "already" ? 200 : out.status === "not_yet" ? 409 : 400, out);
    }
    return wiredJson(400, { error: "action must be apply, status, survey or retake" });
  } catch (err) {
    console.error("wired-pilot:", err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: "could_not_save" });
  }
});
