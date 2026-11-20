// wired-delete: "Delete my quiz data" (Fearfully & Wonderfully Wired, W9; spec 7.6, answers 10 and 32).
// Public POST, DARK until WIRED_ENABLED. verify_jwt = false (config.toml).
//
//   {action: 'request', token}  from the results page (her results token), or
//   {action: 'request', email}  from the link in any learner email footer (/wired/delete):
//       if a family has that address, we email it the approved confirm email with a signed delete link
//       (24 hours). The answer is always { ok: true }, so the page never tells anyone whether an address
//       took the quiz.
//   {action: 'confirm', token}  the delete link: one transaction (public.wired_delete_family) writes the
//       tombstone (peppered email hash: free children used + last quiz year, so "2 free children per email,
//       ever" and once-a-year survive), removes queue rows, dead-letter payloads, one-a-day log rows and
//       that address's email events, then deletes the family (children, sessions, results, observers, teen
//       links cascade). Purchase records stay with the family link nulled; opt-outs stay. Then the approved
//       "deleted" email goes out.
// Rate limited: 10 requests per IP and 3 per email address per hour.

import { bumpRateBucket, clientIp } from "../_shared/rate-bucket.ts";
import { buildTxEmail, SITE } from "../_shared/wired-email-tx.ts";
import { type Db, emailHash, pg } from "../_shared/wired-submit-flow.ts";
import { signWiredToken, verifyWiredToken } from "../_shared/wired-token.ts";
import { wiredGate, wiredJson } from "../_shared/wired-gate.ts";

const FROM = "Camila at The Eden Institute <hello@edeninstitute.health>";
const REPLY_TO = "hello@edeninstitute.health";
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

async function send(to: string, mail: { subject: string; html: string; text: string }, idem: string, tag: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idem },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject: mail.subject, html: mail.html, text: mail.text, tags: [{ name: "category", value: tag }] }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

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
  const db: Db = { url: Deno.env.get("SUPABASE_URL") ?? "", key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" };

  try {
    if (body.action === "request") {
      const ip = clientIp(req);
      const n = ip ? await bumpRateBucket({ supabaseUrl: db.url, serviceKey: db.key, key: `wired_delete:ip:${ip}`, windowSeconds: 3600 }) : null;
      if ((n ?? 0) > 10) return wiredJson(429, { error: "too_many" });
      let fam: { id: string; email: string } | undefined;
      if (body.token !== undefined) {
        const grant = await verifyWiredToken(body.token, "results");
        if (!grant) return wiredJson(401, { error: "invalid_or_expired_link" });
        fam = (await pg<{ id: string; email: string }[]>(db, `wired_families?id=eq.${grant.familyId}&select=id,email&limit=1`))?.[0];
      } else {
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!EMAIL_RE.test(email)) return wiredJson(400, { error: "invalid_email" });
        const m = await bumpRateBucket({ supabaseUrl: db.url, serviceKey: db.key, key: `wired_delete:email:${email}`, windowSeconds: 3600 });
        if ((m ?? 0) > 3) return wiredJson(200, { ok: true });
        fam = (await pg<{ id: string; email: string }[]>(db, `wired_families?email=eq.${encodeURIComponent(email)}&select=id,email&limit=1`))?.[0];
      }
      if (fam) {
        const token = await signWiredToken({ familyId: fam.id, purpose: "delete" });
        const mail = buildTxEmail("em-delete-confirm", { buttonUrl: `${SITE}/wired/delete?c=${encodeURIComponent(token)}` });
        await send(fam.email, mail, `wired-delete-confirm-${fam.id}-${Math.floor(Date.now() / 600_000)}`, "wired_delete_confirm");
      }
      return wiredJson(200, { ok: true });
    }

    if (body.action === "confirm") {
      const grant = await verifyWiredToken(body.token, "delete");
      if (!grant) return wiredJson(401, { error: "invalid_or_expired_link" });
      const fam = (await pg<{ email: string }[]>(db, `wired_families?id=eq.${grant.familyId}&select=email&limit=1`))?.[0];
      if (!fam) return wiredJson(200, { deleted: true, already: true });
      const hash = await emailHash(fam.email, Deno.env.get("WIRED_EMAIL_PEPPER") ?? "");
      const out = await pg<Record<string, unknown>>(db, "rpc/wired_delete_family", { method: "POST", body: JSON.stringify({ p_family: grant.familyId, p_email_hash: hash }) });
      console.log(`wired-delete: family deleted ${JSON.stringify({ ...out })}`);
      try {
        await send(fam.email, buildTxEmail("em-delete-done", {}), `wired-delete-done-${grant.familyId}`, "wired_delete_done");
      } catch (err) {
        console.error("wired-delete: the 'deleted' email failed (the data IS deleted):", err instanceof Error ? err.message : String(err));
      }
      return wiredJson(200, { deleted: true });
    }
    return wiredJson(400, { error: "action must be request or confirm" });
  } catch (err) {
    console.error("wired-delete:", err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: "could_not_finish" });
  }
});
