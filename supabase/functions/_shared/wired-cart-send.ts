// supabase/functions/_shared/wired-cart-send.ts
// Sends the wired cart reminders that are due (scheduled by stripe-webhook at session created + 24 h; see
// wired-cart-reminder.ts). Run by wired-pdf (every 5 minutes) after the PDFs and learner emails. Per row:
// claim (reason wired_scheduled -> send_in_progress) -> re-check at send time: bought since (orders / payments /
// the pending checkout paid), another reminder in the last 30 days, a global or 'cart' opt-out, a hard bounce or
// complaint -> build the approved email -> list 'cart' unsubscribe -> send (Idempotency-Key per session) -> mark.

import { type Db, pg } from "./wired-submit-flow.ts";
import { applyUnsub } from "./email-unsubscribe.ts";
import { buildWiredCartEmail, cartKind, WIRED_SCHEDULED } from "./wired-cart-reminder.ts";
import { CART_RECOVERY_COOLDOWN_DAYS, CART_RECOVERY_SENDING } from "./checkout-recovery.ts";
import { wiringName } from "./wired-pdf.ts";

interface Row { session_id: string; email: string | null; recovery_url: string | null; wired_pending_id: string | null; send_after: string; created_at: string }

export async function sendDueWiredCartReminders(db: Db, o: { resendKey: string; from: string; replyTo: string; now?: Date; dryRun?: boolean }): Promise<Record<string, unknown>> {
  const now = o.now ?? new Date();
  const rows = (await pg<Row[]>(db,
    `checkout_recoveries?reason=eq.${WIRED_SCHEDULED}&send_after=lte.${encodeURIComponent(now.toISOString())}&select=session_id,email,recovery_url,wired_pending_id,send_after,created_at&order=send_after.asc&limit=3`)) ?? [];
  const out = { due: rows.length, sent: 0, skipped: 0, failed: 0, details: [] as unknown[] };
  for (const r of rows) {
    const done = async (status: "sent" | "skipped", reason: string | null, extra: Record<string, unknown> = {}) => {
      await pg(db, `checkout_recoveries?session_id=eq.${encodeURIComponent(r.session_id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status, reason, ...extra }) });
    };
    if (o.dryRun) { out.details.push({ session: r.session_id, dry_run: true }); continue; }
    const claimed = await pg<Row[]>(db, `checkout_recoveries?session_id=eq.${encodeURIComponent(r.session_id)}&reason=eq.${WIRED_SCHEDULED}`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ reason: CART_RECOVERY_SENDING }),
    });
    if (!claimed?.length) continue;
    try {
      const email = (r.email ?? "").trim().toLowerCase();
      if (!email || !r.recovery_url?.startsWith("https://")) { await done("skipped", "wired_no_email_or_link"); out.skipped++; continue; }
      const pending = r.wired_pending_id
        ? (await pg<{ family_id: string; product: string; child_ids: string[]; created_at: string; paid_at: string | null }[]>(db,
          `wired_pending_checkouts?id=eq.${r.wired_pending_id}&select=family_id,product,child_ids,created_at,paid_at&limit=1`))?.[0]
        : undefined;
      if (!pending) { await done("skipped", "wired_pending_gone"); out.skipped++; continue; }
      const since = encodeURIComponent(pending.created_at);
      const like = encodeURIComponent(email.replace(/[%_\\]/g, (m) => `\\${m}`));
      const cool = encodeURIComponent(new Date(now.getTime() - CART_RECOVERY_COOLDOWN_DAYS * 86_400_000).toISOString());
      const [orders, payments, recent, global, listOpt, blocked] = await Promise.all([
        pg<unknown[]>(db, `orders?customer_email=ilike.${like}&created_at=gte.${since}&select=id&limit=1`),
        pg<unknown[]>(db, `payments?customer_email=ilike.${like}&status=eq.paid&occurred_at=gte.${since}&select=id&limit=1`),
        pg<unknown[]>(db, `checkout_recoveries?email=eq.${encodeURIComponent(email)}&status=eq.sent&created_at=gte.${cool}&session_id=neq.${encodeURIComponent(r.session_id)}&select=session_id&limit=1`),
        pg<unknown[]>(db, `waitlist_signups?email=ilike.${like}&unsubscribed_at=not.is.null&select=email&limit=1`),
        pg<unknown[]>(db, `email_list_unsubscribes?email=eq.${encodeURIComponent(email)}&list=eq.cart&select=email&limit=1`),
        pg<boolean>(db, "rpc/email_send_blocked", { method: "POST", body: JSON.stringify({ p_email: email, p_list: "cart", p_queued_at: r.created_at }) }),
      ]);
      const reason = pending.paid_at || orders?.length || payments?.length ? "already_purchased"
        : recent?.length ? "recently_sent" : global?.length ? "globally_suppressed" : listOpt?.length ? "unsubscribed_cart" : blocked === true ? "send_blocked" : null;
      if (reason) { await done("skipped", reason); out.skipped++; out.details.push({ session: r.session_id, skipped: reason }); continue; }

      const fam = (await pg<{ first_name: string | null }[]>(db, `wired_families?id=eq.${pending.family_id}&select=first_name&limit=1`))?.[0];
      const kind = cartKind(pending.product);
      let nickname: string | null = null;
      let topWiring: string | null = null;
      const childId = pending.child_ids?.[0];
      if (childId) {
        nickname = (await pg<{ nickname: string }[]>(db, `wired_children?id=eq.${childId}&select=nickname&limit=1`))?.[0]?.nickname ?? null;
        const top = (await pg<{ top3: string[] }[]>(db, `wired_results?child_id=eq.${childId}&select=top3&order=quiz_year.desc&limit=1`))?.[0]?.top3?.[0];
        topWiring = top ? wiringName(top as never) : null;
      }
      if (kind === "blueprint" && (!nickname || !topWiring)) { await done("skipped", "wired_child_gone"); out.skipped++; continue; }
      const mail = buildWiredCartEmail(kind, { firstName: fam?.first_name ?? null, nickname, topWiring, recoveryUrl: r.recovery_url });
      const { html, headers } = await applyUnsub(mail.html, email, "cart");
      const { html: text } = await applyUnsub(mail.text, email, "cart");
      if (!o.resendKey) throw new Error("RESEND_API_KEY is not set");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${o.resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `wired-cart-recovery:${r.session_id}` },
        body: JSON.stringify({ from: o.from, reply_to: o.replyTo, to: [email], subject: mail.subject, html, text, headers, tags: [{ name: "category", value: "wired_cart_reminder" }] }),
      });
      const body = await res.json().catch(() => ({})) as { id?: string; message?: string };
      if (!res.ok) { await done("skipped", `send_failed: ${res.status} ${body.message ?? ""}`.slice(0, 500)); out.failed++; continue; }
      await done("sent", null, { resend_id: body.id ?? null });
      out.sent++; out.details.push({ session: r.session_id, sent: true });
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 400);
      // Fails closed: one reminder never sends after an error; the row records why.
      await done("skipped", `wired_send_error: ${msg}`).catch(() => {});
      out.failed++; out.details.push({ session: r.session_id, error: msg });
    }
  }
  return out;
}
