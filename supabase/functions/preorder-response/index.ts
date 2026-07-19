// preorder-response — the buyer's answer to a delay notice.
//
//   GET /functions/v1/preorder-response?token=...
//
// One click from the delay-notice email. Records either consent to the new date or a
// cancellation, and renders a plain confirmation page.
//
// 435.2(b)(3) requires the cancellation mechanism to be free and easy, at the seller's
// expense. That is why this is a GET with a signed token and no login: the buyer has no
// account, and asking them to authenticate to exercise a legal right would not satisfy
// "easy".
//
// verify_jwt = false. Security is the HMAC token, not a session. The token proves the
// bearer received that specific notice for that specific order; it carries no PII, so a
// forwarded or logged URL leaks nothing beyond the fact that an order exists.
//
// The refund itself is deliberately NOT issued here. This endpoint is public and
// unauthenticated; automatically moving money from it would make a signed URL a
// money-moving instrument. Instead a cancellation is recorded and surfaced to the
// founder, who issues the refund in Stripe. The legal obligation is a PROMPT refund
// (7 working days for a card), not an instantaneous one.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "../_shared/sentry.ts";
import { verifyDelayToken } from "../_shared/delay-consent-token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function page(title: string, body: string, status = 200): Response {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<meta name="robots" content="noindex">`
    + `<title>${title} · The Eden Institute</title></head>`
    + `<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,serif;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">`
    + `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E8E3DA;">`
    + `<tr><td style="background-color:#2C3E2D;padding:28px 20px;text-align:center;">`
    + `<span style="font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C5A44E;">THE EDEN INSTITUTE</span>`
    + `</td></tr><tr><td style="padding:32px 36px;font-size:16px;line-height:1.6;color:#3D3832;">${body}</td></tr>`
    + `</table></td></tr></table></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const h = (t: string) => `<h1 style="font-family:Georgia,serif;font-size:24px;color:#2C3E2D;margin:0 0 16px 0;">${t}</h1>`;
const p = (t: string) => `<p style="margin:0 0 16px 0;">${t}</p>`;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const payload = await verifyDelayToken(token);

    if (!payload) {
      return page("Link not recognised",
        h("That link did not work") +
        p("It may have been altered, or it may be from an older notice that is no longer current.") +
        p("Reply to the email you received and Camila will sort it out personally, or write to "
          + `<a href="mailto:hello@edeninstitute.health">hello@edeninstitute.health</a>.`),
        400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: notice, error } = await db
      .from("order_delay_notices")
      .select("id, response, responded_at")
      .eq("order_id", payload.o)
      .eq("broadcast_id", payload.b)
      .maybeSingle();
    if (error) throw error;

    if (!notice) {
      return page("Notice not found",
        h("We could not find that notice") +
        p("Reply to the email you received and we will take care of it."),
        404);
    }

    // Idempotent: clicking twice, or clicking both buttons, must not thrash the record.
    // First answer wins, and the page says plainly which one it was.
    if (notice.response) {
      const already = notice.response === "consented"
        ? "You have already told us to keep your order. Nothing further is needed."
        : "Your cancellation is already recorded, and your refund is on its way.";
      return page("Already recorded", h("We have your answer") + p(already));
    }

    const { error: updErr } = await db
      .from("order_delay_notices")
      .update({ response: payload.r, responded_at: new Date().toISOString() })
      .eq("id", notice.id)
      .is("response", null);           // lose a race rather than overwrite an answer
    if (updErr) throw updErr;

    if (payload.r === "consented") {
      return page("Thank you",
        h("Thank you for waiting") +
        p("Your order is confirmed and stays in the queue. We will write to you again as "
          + "soon as there is real news, and you can still cancel for a full refund at any "
          + "point before it ships.") +
        p("Grace and health,<br><strong>Camila</strong>"));
    }

    return page("Cancellation received",
      h("Your order is cancelled") +
      p("We are sorry we could not get it to you in the window we promised. Your full "
        + "refund, including shipping, will be returned to your original payment method "
        + "within 7 working days.") +
      p("You do not need to do anything else. If you do not see the refund after that, "
        + `write to <a href="mailto:hello@edeninstitute.health">hello@edeninstitute.health</a> `
        + "and we will chase it.") +
      p("Thank you for backing this at the founding. The door stays open whenever you "
        + "would like to come back.") +
      p("Grace and health,<br><strong>Camila</strong>"));
  } catch (err) {
    console.error("preorder-response error:", err);
    await captureException(err, { function: "preorder-response" });
    return page("Something went wrong",
      h("Something went wrong on our end") +
      p("Your order has not been changed. Please reply to the email you received and "
        + "Camila will handle it personally."),
      500);
  }
});
