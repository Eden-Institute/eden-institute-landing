// list-announce — reach the homeschool LIST (not the preorder cohort).
//
// founder-broadcast already reaches buyers, but it reads preorder_broadcast_list and
// therefore cannot see the ~1,400 people who are on the homeschool list and have never
// ordered. This function is that missing rail.
//
// Modes (POST JSON { mode, ... }):
//   preview → render the email for a sample first name and report the recipient count.
//             Sends nothing. Always run this first; there is no unsend.
//   test    → send one copy to a single explicit address (`to`). Not logged, so it can
//             be repeated while proofing.
//   send    → send to the next `batch` recipients and report what remains.
//
// WHY NOT RESEND BROADCASTS, which is the product literally built for this: the public
// `unsubscribe` function writes ONLY to public.email_list_unsubscribes. It never removes
// the contact from the Resend Audience. A Broadcast would therefore mail everyone who has
// opted out. Sending transactionally against a Supabase query is the only path that
// honours the opt-out list, so that is what this does. See _shared/email-unsubscribe.ts.
//
// SUPPRESSION IS TWO LAYERS AND BOTH ARE LOAD BEARING:
//   1. waitlist_signups.unsubscribed_at — GLOBAL. Resend-level unsubscribes, hard bounces
//      and spam complaints, written by resend-webhook.
//   2. email_list_unsubscribes           — PER LIST. Voluntary one-click opt-out.
// Skipping either one mails somebody who told us to stop.
//
// IDEMPOTENCY: the founders_send_log row is claimed BEFORE the send, not after. Its
// primary key is (campaign, email), so a duplicate claim raises 23505 and that recipient
// is skipped. A crash between claim and send therefore drops at most one email, whereas
// logging after the send would re-mail everyone from the crash point on a retry. For a
// 1,400-person list that asymmetry is the whole design: under-sending by one is a
// nuisance, double-sending is a reputation event.
//
// Gate: service role only. There is no founder-email path and no anon path, because
// nothing in a browser should ever be one request away from mailing the entire list.
//
// Copy rule: no em dashes (feedback_no_em_dashes).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { launchWrapper } from "../_shared/launch-sequence-templates.ts";
import { applyUnsub } from "../_shared/email-unsubscribe.ts";
import { isServiceRoleRequest } from "../_shared/require-service-role.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const FROM = "Camila at The Eden Institute <hello@edeninstitute.health>";
const REPLY_TO = "hello@edeninstitute.health";
const SITE = "https://edeninstitute.health";

// The campaign key IS the idempotency key. Changing this string re-sends to everyone,
// so it is a constant in source rather than a request parameter.
const CAMPAIGN = "starter_announcement_2026_08_27";

const SUBJECT = "An honest update, and the nine weeks you can start now";

// Ship dates mirror _shared/order-config.ts and _shared/launch-sequence-templates.ts.
// They are duplicated here deliberately, exactly as launch-sequence-templates duplicates
// them, because this file must not import a constant that a future edit could move
// underneath it without a redeploy of this function. If the window changes, grep for the
// literal string across the repo; on 2026-08-26 it lived in seven independent places.
const SHIP_TARGET = "July 31, 2027";
const SHIP_GUARANTEE = "September 30, 2027";

const KIT_FOUNDING = "$249";
const KIT_RETAIL = "$349";
const STARTER_PRICE = "$39";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);

// ── Copy helpers, matching launch-sequence-templates.ts byte for byte so this email
//    renders identically to the sequence it lands beside. They are not exported there,
//    and exporting them would make every importer of that file stale and force a
//    transitive redeploy, so they are copied rather than shared.
const BRAND = {
  bgOuter: "#F5F0E8",
  forest: "#2C3E2D",
  text: "#3D3832",
  gold: "#C5A44E",
  sage: "#5C7A5C",
  footerText: "#6B6560",
};

function p(text: string, extra = ""): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}

function bullet(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 8px 0;padding-left:16px;">&middot; ${text}</p>`;
}

function goldDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function verseCard(quote: string, ref: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
<tr><td style="background-color:${BRAND.bgOuter};padding:18px 22px;border-left:3px solid ${BRAND.gold};">
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.65;color:${BRAND.forest};margin:0 0 6px 0;font-style:italic;">&ldquo;${quote}&rdquo;</p>
<p style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};margin:0;letter-spacing:1px;">${ref} (NASB)</p>
</td></tr>
</table>`;
}

function brandButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr><td align="center" style="background-color:${BRAND.forest};border-radius:8px;">
<a href="${url}" target="_blank" style="display:inline-block;background-color:${BRAND.forest};color:${BRAND.gold};font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;text-align:center;padding:14px 40px;border-radius:8px;line-height:24px;mso-line-height-rule:exactly;">${label}</a>
</td></tr>
</table>
</td></tr>
</table>`;
}

function preheader(text: string): string {
  return `<div style="display:none;font-size:1px;color:${BRAND.bgOuter};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${text}</div>`;
}

function signature(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:24px 0 4px 0;">Grace and health,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="${SITE}" style="color:${BRAND.sage};text-decoration:underline;">edeninstitute.health</a></p>`;
}

/**
 * The announcement.
 *
 * Three constraints shaped this copy and each one is a decision already on record:
 *
 *  1. The MANUFACTURER IS PRIVATE. No overseas production, freight, customs or time
 *     zones in any customer-facing copy. The stated reason stops at proofs not being
 *     in hand, which is true and sufficient.
 *  2. The internal reason also included needing runway to chase funding. That is real
 *     but it is not a customer's business, and telling a buyer you are raising money
 *     reads as instability. Omitted on purpose, not by oversight.
 *  3. The founding-500 BENEFIT is currently described two different ways in two live
 *     places and has not been reconciled. So this email states the founding PRICE,
 *     which is verified everywhere, and makes no claim about the perk.
 */
function buildAnnouncement(firstName: string): string {
  const body =
    preheader(`The print run moved to 2027. The first nine weeks are ready to download today.`) +
    p(`Hi ${firstName},`) +
    p(`I would rather you hear this from me than notice it on the website.`) +
    p(`<strong>The first Eden&rsquo;s Table print run has moved.</strong> Kits are now aiming to ship ${SHIP_TARGET}, and every kit is guaranteed to ship on or before ${SHIP_GUARANTEE}. If you were planning to start Eden&rsquo;s Table this fall, that is not what you were hoping to read, and I am not going to soften it.`) +
    p(`Here is the honest reason. I do not have the printer proofs in my hands yet. Not the paper, not the binding, not the colour on the botanical plates. I am not willing to commit a full print run I have not held, checked and read cover to cover, because the copy that arrives at your table is the one your children will actually remember. Rushing it would mean sending you something I had only ever seen on a screen.`) +
    verseCard(
      `Also it is not good for a person to be without knowledge, and one who hurries his footsteps errs.`,
      `Proverbs 19:2`,
    ) +
    p(`So that is the cost, and I am carrying it.`) +
    goldDivider() +
    p(`But I kept thinking about the families who told me they wanted to start <em>this</em> year. A promise about next summer does nothing for a child who is five right now.`) +
    p(`<strong>So I built the part that does not need a printing press.</strong>`) +
    p(`The first nine weeks of Sprouts are finished, and you can download them today. Not a sample and not a preview. Nine complete weeks:`) +
    bullet(`The <strong>Teacher&rsquo;s Guide</strong> for those nine weeks. Every daily lesson, the botany behind each herb, and what to say when a five year old asks why.`) +
    bullet(`The <strong>Student Notebook</strong> pages your child works in.`) +
    bullet(`The <strong>Read-Aloud storybook</strong>, four of the year&rsquo;s seven story readings, the part the whole table listens to.`) +
    p(`It is ${STARTER_PRICE}, it reaches your inbox in about a minute, and it is yours to keep.`) +
    goldDivider() +
    p(`<strong>And here is the part that matters most.</strong> If you go on to order the printed kit, the entire ${STARTER_PRICE} comes off the price. Not a percentage, and not a code you have to remember. The full ${STARTER_PRICE}, credited to you.`) +
    p(`Which means starting now costs you nothing against the kit. And if the nine weeks turn out not to suit your family, you will have spent ${STARTER_PRICE} to find that out for certain, instead of ${KIT_FOUNDING}.`) +
    brandButton(`Start the first nine weeks &nbsp;&rarr;`, `${SITE}/starter`) +
    p(
      `The kit itself is unchanged: ${KIT_FOUNDING} for the founding 500 families, ${KIT_RETAIL} after that.`,
      `text-align:center;font-size:15px;color:${BRAND.footerText};`,
    ) +
    goldDivider() +
    p(`One more thing. If this update changes things for you, or if you have been sitting on the fence and want to ask me something first, just hit reply. It comes straight to me.`) +
    signature();
  return launchWrapper(body);
}

// ── Recipients ────────────────────────────────────────────────────────────────
//
// PostgREST caps every response at 1000 rows SILENTLY. Each list below is therefore
// paged. Getting this wrong does not error, it just quietly mails a subset and reports
// success, which is the same class of bug that let two scheduled tasks look healthy for
// three weeks while selecting nothing.
const PAGE = 500;

async function pagedColumn(
  db: ReturnType<typeof admin>,
  table: string,
  column: string,
  order: string,
): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(column)
      .order(order, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    // Cast through unknown: a runtime-chosen column name defeats supabase-js's
    // generic inference, which falls back to GenericStringError[].
    const rows = (data ?? []) as unknown as Array<Record<string, string | null>>;
    for (const r of rows) {
      const v = r[column];
      if (typeof v === "string" && v.trim()) out.push(v.trim().toLowerCase());
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

interface Recipient {
  email: string;
  first_name: string;
}

async function recipients(db: ReturnType<typeof admin>): Promise<Recipient[]> {
  // The list itself: homeschool funnel, not globally unsubscribed or bounced.
  const raw: Array<{ email: string | null; first_name: string | null }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("waitlist_signups")
      .select("email, first_name, created_at")
      .eq("entry_funnel", "edens_table")
      .is("unsubscribed_at", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`waitlist_signups: ${error.message}`);
    const rows = (data ?? []) as Array<{ email: string | null; first_name: string | null }>;
    raw.push(...rows);
    if (rows.length < PAGE) break;
  }

  const optedOut = new Set(await pagedColumn(db, "email_list_unsubscribes", "email", "email"));
  const buyers = new Set(
    await pagedColumn(db, "preorder_broadcast_list", "customer_email", "customer_email"),
  );

  // Already sent this campaign. Filtered here as well as claimed at send time: this
  // keeps the reported "remaining" honest across batches.
  const sent = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("founders_send_log")
      .select("email")
      .eq("campaign", CAMPAIGN)
      .order("email", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`founders_send_log: ${error.message}`);
    const rows = (data ?? []) as Array<{ email: string }>;
    for (const r of rows) sent.add(r.email.trim().toLowerCase());
    if (rows.length < PAGE) break;
  }

  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of raw) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    if (seen.has(email)) continue; // the list can hold the same address twice
    if (optedOut.has(email) || buyers.has(email) || sent.has(email)) continue;
    seen.add(email);
    const name = (r.first_name ?? "").trim();
    // Never render "Hi ," at somebody. A neutral greeting is better than a blank.
    out.push({ email, first_name: name || "there" });
  }
  return out;
}

/** One send. Returns null on success, or the error string. */
async function sendOne(to: string, firstName: string): Promise<string | null> {
  const { html, headers } = await applyUnsub(buildAnnouncement(firstName), to, "homeschool");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject: SUBJECT,
      html,
      headers,
    }),
  });
  if (res.ok) return null;
  return `${res.status} ${(await res.text()).slice(0, 200)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!isServiceRoleRequest(req)) return json({ error: "forbidden" }, 403);
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY missing" }, 503);

  let payload: { mode?: string; to?: string; batch?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const mode = payload.mode ?? "preview";
  const db = admin();

  try {
    if (mode === "preview") {
      const list = await recipients(db);
      const html = buildAnnouncement("Sarah");
      return json({
        mode,
        campaign: CAMPAIGN,
        subject: SUBJECT,
        remaining: list.length,
        sample_recipients: list.slice(0, 5).map((r) => r.email),
        html_bytes: html.length,
        html,
      });
    }

    if (mode === "test") {
      const to = (payload.to ?? "").trim();
      if (!to.includes("@")) return json({ error: "test mode needs a valid `to`" }, 400);
      const err = await sendOne(to, "Camila");
      return err ? json({ mode, to, ok: false, error: err }, 502) : json({ mode, to, ok: true });
    }

    if (mode === "send") {
      const batch = Math.min(Math.max(payload.batch ?? 200, 1), 400);
      const list = await recipients(db);
      const slice = list.slice(0, batch);

      let sent = 0;
      const failures: Array<{ email: string; error: string }> = [];

      for (const r of slice) {
        // CLAIM FIRST. A 23505 here means another batch already took this address.
        const { error: claimErr } = await db
          .from("founders_send_log")
          .insert({ campaign: CAMPAIGN, email: r.email });
        if (claimErr) {
          if (claimErr.code === "23505") continue;
          failures.push({ email: r.email, error: `claim: ${claimErr.message}` });
          continue;
        }

        const err = await sendOne(r.email, r.first_name);
        if (err) {
          // Release the claim so a later batch can retry this one. Safe because the
          // send demonstrably did not succeed.
          await db.from("founders_send_log").delete()
            .eq("campaign", CAMPAIGN).eq("email", r.email);
          failures.push({ email: r.email, error: err });
          // Resend rate limiting: back off rather than burning through the batch.
          if (err.startsWith("429")) await new Promise((res) => setTimeout(res, 1200));
          continue;
        }
        sent++;
        // Stay well under Resend's rate limit. 120ms is roughly 8/sec.
        await new Promise((res) => setTimeout(res, 120));
      }

      return json({
        mode,
        campaign: CAMPAIGN,
        sent,
        failed: failures.length,
        failures: failures.slice(0, 20),
        remaining: Math.max(list.length - slice.length, 0),
      });
    }

    return json({ error: `unknown mode: ${mode}` }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500);
  }
});
