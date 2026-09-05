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
const CAMPAIGN = "starter_showtheweek_2026_09_07";

const SUBJECT = "Now available: start Sprouts on Monday";

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

function quoteCard(quote: string, who: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
<tr><td style="background-color:${BRAND.bgOuter};padding:18px 22px;border-left:3px solid ${BRAND.sage};">
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.65;color:${BRAND.forest};margin:0 0 6px 0;">&ldquo;${quote}&rdquo;</p>
<p style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};margin:0;">${who}</p>
</td></tr>
</table>`;
}

function textLink(label: string, url: string): string {
  return `<a href="${url}" style="color:${BRAND.sage};text-decoration:underline;font-weight:bold;">${label}</a>`;
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
 * The announcement, second pass.
 *
 * WHY THIS EMAIL EXISTS AND WHY IT IS SHAPED LIKE THIS. Four emails have already told
 * this list that the nine weeks are ready: the Aug 27 announcement above, launch 19
 * (Aug 31), launch 20 (Sep 4), and launch 21 (queued). Measured 2026-09-05: 713 distinct
 * people OPENED them and 679 of those never clicked anything. Opens run 32 to 38 percent,
 * which is healthy. The failure is entirely the click, at roughly 0.6 percent.
 *
 * So this email does not describe the product a fifth time. It SHOWS one week, day by
 * day, transcribed off the real Teacher's Guide pages, and it carries FOUR links instead
 * of one button at the bottom, which is the likeliest mechanical cause of the click rate.
 *
 * Constraints, each one already on record:
 *  1. NO INVENTED URGENCY. Launch 21 says in writing "there is no deadline on it". No
 *     countdown, no scarcity, no expiring bonus. The calendar is the only clock.
 *  2. "The whole $39 comes off it", never "comes back". It is a credit against the kit,
 *     not a refund, and the download is not refundable once taken.
 *  3. Only Amanda is quoted. She is the sole tester who gave written permission to
 *     publish (2026-07-06). The other four testers are not named.
 *  4. No em dashes. No podcast air dates, because nothing has aired.
 *
 * The week 9 content is transcribed from FINAL_Sprouts_TG_Part1, printed pages 62 to 65,
 * read as rendered images because the PDF is a Canva export with no extractable text.
 * NOTE the content manual calls Wednesday a "marshmallow CONFECTION"; the actual page is
 * a cold infusion sweetened with honey. The page wins.
 */
function buildAnnouncement(firstName: string): string {
  const STARTER = `${SITE}/starter`;
  const body =
    preheader(`No printing press, no 2027. Weeks 1 through 9 download the minute you buy them.`) +
    p(`Hi ${firstName},`) +
    p(`I keep hearing the same thing from mamas, and it is always some version of the same sentence: I do not want to wait.`) +
    p(`Neither would I. So here is the part of Eden&rsquo;s Table that needs no printing press and no waiting. <strong>The first nine weeks of Sprouts are finished, and they download the minute you buy them.</strong>`) +
    brandButton(`Get the Digital Starter Unit &nbsp;&middot;&nbsp; ${STARTER_PRICE}`, STARTER) +
    p(`And rather than tell you a fourth time that they exist, let me actually show you one. Here is week 9, exactly as it sits in the Teacher&rsquo;s Guide.`) +
    goldDivider() +
    p(`<strong>Monday &middot; Read-Aloud &amp; Discussion.</strong> You open Psalm 1 and read about the tree planted by streams of water. Your child meets marshmallow root, a pale root that soaks quietly in water until it turns silky and slippery. That verse is the week&rsquo;s memory verse.`) +
    p(`<strong>Tuesday &middot; Discovery.</strong> Where it grows and why. Marshmallow likes to keep its feet wet, in damp ground near streams and salt marshes, and that is how it earned its name, the mallow of the marsh. Your child draws it and labels root, stem and flower. The word for the day is EMOLLIENT.`) +
    p(`<strong>Wednesday &middot; Kitchen Lab.</strong> Two tablespoons of dried root, two cups of cool water, soak four hours, strain the silky liquid, stir in honey. You start it in the morning and it soaks while you play.`) +
    p(`<strong>Thursday &middot; History &amp; Art.</strong> Ancient Egypt, beside the Nile. People dug the root, found that soaked in water it turned soft and slippery like silk, and stirred its juice with honey into a chewy treat that was saved for kings and queens. That was the first marshmallow. Your child draws the Nile, grows tall marshmallow plants with pink flowers along its banks, adds a royal plate of honey sweets, and titles it &ldquo;The King&rsquo;s Sweet Root.&rdquo;`) +
    p(`<strong>Friday &middot; Garden &amp; Review.</strong> The garden activity, the week&rsquo;s review questions, the verse one more time.`) +
    goldDivider() +
    p(`That is one week. There are nine, and every one is built to that same shape, so by week three nobody is asking what today is. ${textLink('See all nine weeks', STARTER)}.`) +
    p(`Every page carries two extra lines, one for Little Sprouts and one for Older Sprouts. On that Wednesday the little ones spoon the root into the jar and give it a stir. The older ones add the water, strain it hours later, and feel how slippery it turned. Same lesson, same table, nobody sent off to do something separate.`) +
    p(`The sources are printed on the page, not hidden at the back. Week 9 cites King&rsquo;s American Dispensatory (1898) and Grieve (1931). Every day lists its own learning benchmarks, so if you have to report, it is already written down for you.`) +
    p(`<strong>If you start Monday, you finish the week of November 3.</strong> A full quarter of the year, done before the holidays. That is the only clock on this, and it is the reason I am writing again rather than waiting.`) +
    quoteCard(
      `I am a mother who has been homeschooling kids for over 18 years. The balance of faith and herb/gardening is perfect, it is a complete lesson and well thought out. The lessons for younger kids are easy to understand and get a little more in depth when moving up a level.`,
      `Amanda, homeschooling 18 years, 9 in the house`,
    ) +
    goldDivider() +
    p(`The Sprouts Starter Unit is <strong>${STARTER_PRICE}</strong>. Weeks 1 through 9, digital, in your inbox in about a minute: the Teacher&rsquo;s Guide, the Student Notebook and the Read-Aloud storybook for those nine weeks. Buy the printed kit later and the whole ${STARTER_PRICE} comes off it, so you will not pay for these nine weeks twice.`) +
    brandButton(`Start with weeks 1 through 9 &nbsp;&rarr;`, STARTER) +
    p(
      `The printed Sprouts Complete Kit is still ${KIT_FOUNDING} for the founding 500 families and ${KIT_RETAIL} after that.`,
      `text-align:center;font-size:15px;color:${BRAND.footerText};`,
    ) +
    goldDivider() +
    p(`There is no deadline on the ${STARTER_PRICE} and I am not going to invent one. The only thing running is the school year. If this is not your year, I will still be here when it is, and if you have a question you would rather ask me than read on a page, just hit reply. It comes straight to me.`) +
    signature() +
    p(
      `<strong>P.S.</strong> Nine weeks started this Monday finish the week of November 3. If you would rather not wait until 2027 to begin, ${textLink('this is the part you can start today', STARTER)}.`,
      `margin-top:24px;`,
    );
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

/**
 * Everyone who has already paid for the Starter Unit. They own weeks 1 to 9 already.
 * Filtered by lookup_key rather than by a hardcoded address list so this stays correct
 * as more people buy between the preview and the last batch.
 */
async function starterBuyers(db: ReturnType<typeof admin>): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("orders")
      .select("customer_email")
      .eq("lookup_key", "sprouts_starter_unit")
      .eq("payment_status", "paid")
      .order("customer_email", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`orders: ${error.message}`);
    const rows = (data ?? []) as Array<{ customer_email: string | null }>;
    for (const r of rows) {
      const v = (r.customer_email ?? "").trim().toLowerCase();
      if (v) out.add(v);
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
  const started = await starterBuyers(db);

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
    if (optedOut.has(email) || buyers.has(email) || started.has(email) || sent.has(email)) continue;
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
