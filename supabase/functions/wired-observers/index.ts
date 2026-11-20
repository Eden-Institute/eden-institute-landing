// wired-observers: mom invites up to 3 people per child to share how they see that child (Fearfully &
// Wonderfully Wired, W9; spec 7.4, section 4 deletion rule, answers 11 and 32). Public POST
// {token, child_id, action: 'list' | 'add' | 'remove', email?, label?, observer_id?}, DARK until
// WIRED_ENABLED. verify_jwt = false (config.toml).
//
// A Blueprint feature: only for a child unlocked by a Blueprint or the Family Map. Max 3 active per child.
// add: stores the email (lower-cased) + her label, a 30-day link (only its hash), and queues the invite
// (kind observer_invite; the drain sends it, never held by the one-a-day guard; the reminder comes from
// wired-cron on day 5 only if unanswered). The email is never put on any list. remove: hard-deletes the
// email at once (email + link hash nulled, removed_at/deleted_at stamped) and cancels unsent emails to them.
// list: label + status only; the email shows masked.

import { familyChildRequest } from "../_shared/wired-family-auth.ts";
import { MAX_OBSERVERS, OBSERVER_LABELS, OBSERVER_LINK_DAYS, observerCode, sha256Hex } from "../_shared/wired-raters.ts";
import { pg } from "../_shared/wired-submit-flow.ts";
import { quizYear } from "../_shared/wired-engine.ts";
import { wiredJson } from "../_shared/wired-gate.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

interface ObsRow { id: string; email: string | null; label: string | null; invited_at: string | null; token_expires_at: string | null; last_completed_quiz_year: number | null; quiz_year: number | null }

export function maskEmail(e: string | null): string {
  if (!e) return "";
  const [u, d] = e.split("@");
  return `${u.slice(0, 1)}***@${d ?? ""}`;
}

Deno.serve(async (req) => {
  const r = await familyChildRequest(req, "wired-observers");
  if (r instanceof Response) return r;
  const { db, body, familyId, child, family } = r;
  if (child.unlocked_via !== "blueprint" && child.unlocked_via !== "family_map") return wiredJson(403, { error: "blueprint_needed" });
  const action = body.action;
  const now = new Date();
  const active = async () => (await pg<ObsRow[]>(db,
    `wired_observers?child_id=eq.${child.id}&family_id=eq.${familyId}&removed_at=is.null&select=id,email,label,invited_at,token_expires_at,last_completed_quiz_year,quiz_year&order=created_at.asc`)) ?? [];
  const list = (rows: ObsRow[]) => rows.map((o) => ({
    id: o.id, label: o.label, email: maskEmail(o.email),
    status: o.last_completed_quiz_year !== null && o.last_completed_quiz_year >= (o.quiz_year ?? quizYear(now)) ? "answered"
      : o.token_expires_at && Date.parse(o.token_expires_at) <= now.getTime() ? "expired" : "invited",
  }));

  try {
    if (action === "list") return wiredJson(200, { observers: list(await active()), max: MAX_OBSERVERS });

    if (action === "add") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const label = typeof body.label === "string" ? body.label : "";
      if (!EMAIL_RE.test(email) || email.length > 254) return wiredJson(400, { error: "invalid_email" });
      if (!(OBSERVER_LABELS as readonly string[]).includes(label)) return wiredJson(400, { error: "invalid_label" });
      if (email === family.email.trim().toLowerCase()) return wiredJson(400, { error: "that_is_your_own_email" });
      const rows = await active();
      if (rows.length >= MAX_OBSERVERS) return wiredJson(409, { error: "max_observers", max: MAX_OBSERVERS });
      if (rows.some((o) => o.email === email)) return wiredJson(409, { error: "already_invited" });
      const ins = await pg<{ id: string }[]>(db, "wired_observers", {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          family_id: familyId, child_id: child.id, email, label, invited_at: now.toISOString(), quiz_year: quizYear(now),
          token_expires_at: new Date(now.getTime() + OBSERVER_LINK_DAYS * 86_400_000).toISOString(),
        }),
      });
      const id = ins?.[0]?.id;
      if (!id) throw new Error("observer insert returned nothing");
      await pg(db, `wired_observers?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ token_hash: await sha256Hex(await observerCode(id)) }) });
      await pg(db, "wired_email_queue", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ family_id: familyId, child_id: child.id, observer_id: id, email, kind: "observer_invite", scheduled_for: now.toISOString() }),
      });
      return wiredJson(200, { observers: list(await active()), max: MAX_OBSERVERS });
    }

    if (action === "remove") {
      if (typeof body.observer_id !== "string" || !UUID_RE.test(body.observer_id)) return wiredJson(400, { error: "observer_id is required" });
      const obs = (await pg<{ email: string | null }[]>(db, `wired_observers?id=eq.${body.observer_id}&child_id=eq.${child.id}&family_id=eq.${familyId}&select=email&limit=1`))?.[0];
      if (!obs) return wiredJson(404, { error: "unknown_observer" });
      // Hard-delete their address everywhere we hold it: unsent emails are cancelled, every queue row
      // (sent ones too) loses the address, and Resend's open/click events for it are removed.
      await pg(db, `wired_email_queue?observer_id=eq.${body.observer_id}&sent_at=is.null&failed_at=is.null&skipped_reason=is.null`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ skipped_reason: "observer_removed" }),
      });
      await pg(db, `wired_email_queue?observer_id=eq.${body.observer_id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ email: "removed@invalid" }),
      });
      const sentIds = ((await pg<{ resend_id: string | null }[]>(db, `wired_email_queue?observer_id=eq.${body.observer_id}&resend_id=not.is.null&select=resend_id`)) ?? [])
        .map((x) => x.resend_id).filter((x): x is string => !!x && /^[A-Za-z0-9-]+$/.test(x));
      if (sentIds.length) {
        await pg(db, `email_events?resend_email_id=in.(${sentIds.join(",")})`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      }
      await pg(db, `wired_observers?id=eq.${body.observer_id}&child_id=eq.${child.id}&family_id=eq.${familyId}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ email: null, token_hash: null, removed_at: now.toISOString(), deleted_at: now.toISOString() }),
      });
      return wiredJson(200, { observers: list(await active()), max: MAX_OBSERVERS });
    }
    return wiredJson(400, { error: "action must be list, add or remove" });
  } catch (err) {
    console.error("wired-observers:", err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: "could_not_save" });
  }
});
