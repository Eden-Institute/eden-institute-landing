// wired-rater: the teen and observer side of the quiz (Fearfully & Wonderfully Wired, W9; spec 7.3, 7.4,
// answers 11, 23). Public POST {kind: 'teen' | 'observer', code, action: 'context' | 'submit',
// bank_version?, answers?}, DARK until WIRED_ENABLED. verify_jwt = false (config.toml).
//
// context: checks the private link and answers only what the page needs: the child's nickname, mom's first
// name (else "[Nickname]'s mom"), which question set to load, and the observer's label. Nothing else about
// the child or family. submit: scores the answers and recomputes the blend (_shared/wired-raters.ts), marks
// the link used, and queues mom's email. Rate limited per IP (60 an hour, like wired-submit).

import { bumpRateBucket, clientIp } from "../_shared/rate-bucket.ts";
import { processRaterSubmission, type RaterKind, resolveRaterLink } from "../_shared/wired-raters.ts";
import { cleanAnswers } from "../_shared/wired-submit-core.ts";
import { type Db } from "../_shared/wired-submit-flow.ts";
import { wiredGate, wiredJson } from "../_shared/wired-gate.ts";

const IP_PER_HOUR = 60;

Deno.serve(async (req) => {
  const gate = wiredGate(req);
  if (gate) return gate;
  if (req.method !== "POST") return wiredJson(405, { error: "method_not_allowed" });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return wiredJson(400, { error: "body must be JSON" });
  }
  const kind = body.kind === "teen" || body.kind === "observer" ? body.kind as RaterKind : null;
  if (!kind) return wiredJson(400, { error: "kind must be teen or observer" });
  const db: Db = { url: Deno.env.get("SUPABASE_URL") ?? "", key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" };

  const ip = clientIp(req);
  const n = ip ? await bumpRateBucket({ supabaseUrl: db.url, serviceKey: db.key, key: `wired_rater:ip:${ip}`, windowSeconds: 3600 }) : null;
  if ((n ?? 0) > IP_PER_HOUR) return wiredJson(429, { error: "too_many" });

  try {
    const ctx = await resolveRaterLink(db, kind, body.code);
    if ("error" in ctx) return wiredJson(ctx.error === "invalid_link" ? 404 : 410, { error: ctx.error });
    if (body.action === "context") {
      return wiredJson(200, {
        nickname: ctx.nickname, mom: ctx.momName ?? `${ctx.nickname}'s mom`, set_kind: ctx.setKind, label: ctx.label,
      });
    }
    if (body.action === "submit") {
      const answers = cleanAnswers(body.answers);
      if (!answers || typeof body.bank_version !== "string") return wiredJson(400, { error: "answers and bank_version are required" });
      const out = await processRaterSubmission(db, ctx, body.bank_version, answers);
      if (out.status === "ok" || out.status === "already_completed") return wiredJson(200, { status: out.status });
      if (out.status === "no_mom_quiz") return wiredJson(409, { error: "no_mom_quiz" });
      return wiredJson(400, { error: "invalid", message: out.message });
    }
    return wiredJson(400, { error: "action must be context or submit" });
  } catch (err) {
    console.error("wired-rater:", err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: "could_not_save" });
  }
});
