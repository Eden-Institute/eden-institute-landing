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
//             REQUIRES `confirm_campaign`: the exact `campaign` value preview returned.
//             Without it, or with any other value, the function answers 400 and sends
//             nothing (type-to-confirm, founder decision 2026-09-15).
//
// Calling it (service-role key; there is no dashboard button for this function):
//   1. preview:  {"mode":"preview"}
//                -> read `campaign`, `subject`, `remaining`, and proof the `html`.
//   2. test:     {"mode":"test","to":"hello@edeninstitute.health"}
//   3. send:     {"mode":"send","batch":200,"confirm_campaign":"<campaign from preview>"}
//                Repeat until `remaining` is 0. Every batch needs confirm_campaign.
// A saved curl or script from an earlier campaign stops working on purpose: its
// confirm_campaign no longer matches, so it cannot mail the new copy by accident.
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
//   2. email_list_unsubscribes           — PER LIST. Voluntary one-click opt-out. Only
//      list = 'homeschool' rows apply here (the list these emails carry).
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
import { checkCampaignConfirm } from "../_shared/send-confirm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const FROM = "Camila at The Eden Institute <hello@edeninstitute.health>";
const REPLY_TO = "hello@edeninstitute.health";
const SITE = "https://edeninstitute.health";

// The campaign key IS the idempotency key. Changing this string re-sends to everyone,
// so it is a constant in source rather than a request parameter.
// 2026-09-12: the print-first pivot letter. The previous campaign
// ("starter_showtheweek_2026_09_07", subject "Now available: start Sprouts on
// Monday") already sent; its copy is on 7233f0e. A NEW key is what makes this a
// new send: every address is claimed once per campaign in founders_send_log.
// 2026-09-14: the ESA approval announcement. The previous campaign
// ("print_first_pivot_letter_2026_09_12", subject "The kit is coming off the website.
// Here is why.") already sent; its copy is on f6bfb83.
// 2026-09-24: Seedlings is live. The previous campaign
// ("esa_approval_announcement_2026_09_14", subject "Check if you qualify to get this
// paid for by your ESA") already sent; its copy is on ebfd814.
// 2026-09-28: the one resend of it to people who did not open it, with a new
// subject (founder's pick 2026-09-24). Resends are the founder's "fewer, better"
// rule: each list email gets ONE resend to non-openers, then nothing more.
const CAMPAIGN = "seedlings_live_resend_2026_09_28";

// When set, this campaign goes ONLY to people who received RESEND_OF and have no
// open or click on it (matched by that email's exact subject, so opening some
// other email does not count). Set to null for an ordinary new campaign.
const RESEND_OF: { campaign: string; subject: string } | null = {
  campaign: "seedlings_live_2026_09_24",
  subject: "Seedlings is live (and you\u2019re the first to know)",
};

// Founder decision 2026-09-24: anyone who joined more than 90 days ago and has not
// opened or clicked ANY email in the last 90 days stops getting list blasts. They
// stay on the list and nothing is unsubscribed; opening any email brings them back.
const DORMANT_DAYS = 90;

// Founder's pick, 2026-09-24. The original's subject was "Seedlings is live (and
// you're the first to know)".
const SUBJECT = "In case you missed it: Seedlings is here";

// Ship dates mirror _shared/order-config.ts and _shared/launch-sequence-templates.ts.
// They are duplicated here deliberately, exactly as launch-sequence-templates duplicates
// them, because this file must not import a constant that a future edit could move
// underneath it without a redeploy of this function. If the window changes, grep for the
// literal string across the repo; on 2026-08-26 it lived in seven independent places.
const SHIP_TARGET = "July 31, 2027";
const SHIP_GUARANTEE = "September 30, 2027";

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

// signoff: "In Him," for a personal letter (the founder's own sign-off, 2026-09-12),
// "Grace and health," to match the automated sequence emails.
function signature(signoff = "Grace and health,"): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:24px 0 4px 0;">${signoff}</p>
<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="${SITE}" style="color:${BRAND.sage};text-decoration:underline;">edeninstitute.health</a></p>`;
}

/**
 * Seedlings is live, to the homeschool list, 2026-09-24.
 *
 * Copy approved in session; Word copy at Eden's Table (Homeschool Curriculum)/Projects/
 * Email Journeys and Nurture/List_Email_Seedlings_Live_2026-09-24.docx. Every claim
 * was read off the live site that day: /books (Seedlings set $249 + $12 shipping, three
 * books, all 36 weeks, extra notebooks $39.99), /starter/seedlings ($39, 9 weeks),
 * /freebies (week 1, five lessons on elderberry) and the band chooser (new to herbs,
 * even grades 3-5, start with Sprouts). Social URLs match src/lib/socials.ts.
 * No preorder language, no credit, no em dashes.
 */
function buildAnnouncement(firstName: string): string {
  const IG = "https://www.instagram.com/edenstablehomeschoolcurriculum";
  const FB = "https://www.facebook.com/EdensTableHomeschoolCurriculum";
  const body =
    preheader(`Grades 3-5, 36 brand new plants, ready to order today.`) +
    p(`Hi ${firstName},`) +
    p(`Seedlings is live!! Our grades 3-5 curriculum is finished, printed and ready to order today. ${textLink("Take a look at Seedlings here.", `${SITE}/books#seedlings`)}`) +
    (RESEND_OF
      ? p(`Sending this one more time in case it got buried in your inbox!`)
      : p(`And you&rsquo;re hearing it first. I haven&rsquo;t posted one word about it on Instagram or Facebook yet. You&rsquo;ve been with me from the very beginning, so you get the news before anyone else does.`)) +
    p(`Seedlings covers 36 new plants. None of them repeat Sprouts, so a family that does both ends up knowing 72. Your kids learn body systems and herb profiles, track a hypothesis across a whole week, and get dinner-table questions that make them actually think. It comes as three printed books: the Teacher&rsquo;s Guide, the Student Notebook and the Read-Aloud Storybook. That&rsquo;s all 36 weeks for $249 plus $12 shipping. Extra notebooks for siblings are $39.99 each.`) +
    brandButton(`See Seedlings`, `${SITE}/books#seedlings`) +
    p(`Want to try it first? The ${textLink(`9-week Seedlings Starter Unit is ${STARTER_PRICE}`, `${SITE}/starter/seedlings`)} and downloads instantly. Or ${textLink("grab week 1 free", `${SITE}/freebies`)}, which is five full lessons on elderberry.`) +
    p(`One quick note before you order. If your kids are new to herbs, even if they&rsquo;re in 3rd to 5th grade, ${textLink("start with Sprouts", `${SITE}/books#sprouts-card`)}. Seedlings builds right on top of those 36 plants. If your older kids already know the basics, go straight to Seedlings. Got little ones and big ones? Do Sprouts together first.`) +
    p(`Now can I ask you a favor? Please follow us on ${textLink("Instagram", IG)} and ${textLink("Facebook", FB)}. ${RESEND_OF ? "Like and share our Seedlings posts!" : "When the Seedlings post goes up, like it and share it!"} We&rsquo;re a small family business, and every share really does help us get this launched. And if you know a family with 3rd to 5th graders, forward them this email.`) +
    p(`Thank you so much for being here from the start!!`) +
    signature("In Him,");
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
  eq?: [string, string],
): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(column);
    if (eq) q = q.eq(eq[0], eq[1]);
    const { data, error } = await q
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
async function starterBuyers(
  db: ReturnType<typeof admin>,
  lookupKeys: string[] = ["sprouts_starter_unit"],
): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("orders")
      .select("customer_email")
      .in("lookup_key", lookupKeys)
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

/** Distinct recipients with an open or click matching the filter, lower-cased. Paged:
 *  PostgREST silently caps a response at 1000 rows. `inserted_at` is used for time
 *  because occurred_at holds the SEND time, not the event time. */
async function engagedRecipients(
  db: ReturnType<typeof admin>,
  sinceIso: string,
  subject?: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    let q = db.from("email_events")
      .select("recipient")
      .in("event_type", ["opened", "clicked"])
      .gte("inserted_at", sinceIso);
    if (subject) q = q.eq("raw->data->>subject", subject);
    const { data, error } = await q.order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`email_events: ${error.message}`);
    const rows = (data ?? []) as Array<{ recipient: string | null }>;
    for (const r of rows) {
      const v = (r.recipient ?? "").trim().toLowerCase();
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
  const raw: Array<{ email: string | null; first_name: string | null; created_at: string | null }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("waitlist_signups")
      .select("email, first_name, created_at")
      .eq("entry_funnel", "edens_table")
      .is("unsubscribed_at", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`waitlist_signups: ${error.message}`);
    const rows = (data ?? []) as Array<{ email: string | null; first_name: string | null; created_at: string | null }>;
    raw.push(...rows);
    if (rows.length < PAGE) break;
  }

  // Only opt-outs from the list this function sends on ('homeschool', see sendOne).
  // Until 2026-09-17 this read EVERY list, so leaving the quiz, buyer or podcast emails
  // also silently dropped someone from Eden broadcasts. nurture-emails and founders-lock
  // already filtered by list; founder decision 2026-09-17: "honor only the list they
  // left". Global unsubscribes, bounces and complaints are unaffected: they live in
  // waitlist_signups.unsubscribed_at, filtered above.
  const optedOut = new Set(
    await pagedColumn(db, "email_list_unsubscribes", "email", "email", ["list", "homeschool"]),
  );
  const buyers = new Set(
    await pagedColumn(db, "preorder_broadcast_list", "customer_email", "customer_email"),
  );
  // Anyone who already bought Seedlings (Starter or printed set) does not need the news.
  const seedlingsBuyers = await starterBuyers(db, ["seedlings_starter_unit", "seedlings_print_set"]);

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

  // Dormant pause (DORMANT_DAYS): joined before the cutoff AND no open/click since it.
  const cutoffIso = new Date(Date.now() - DORMANT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recentlyEngaged = await engagedRecipients(db, cutoffIso);

  // Resend: only people who got RESEND_OF and never opened or clicked it.
  let resendPool: Set<string> | null = null;
  let openedOriginal = new Set<string>();
  if (RESEND_OF) {
    resendPool = new Set<string>();
    let firstSend: string | null = null;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("founders_send_log")
        .select("email, sent_at")
        .eq("campaign", RESEND_OF.campaign)
        .order("email", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`founders_send_log (resend): ${error.message}`);
      const rows = (data ?? []) as Array<{ email: string; sent_at: string }>;
      for (const r of rows) {
        resendPool.add(r.email.trim().toLowerCase());
        if (!firstSend || r.sent_at < firstSend) firstSend = r.sent_at;
      }
      if (rows.length < PAGE) break;
    }
    // An empty pool means the original never sent; refuse rather than mail nobody
    // silently or, worse, fall through to the whole list.
    if (resendPool.size === 0 || !firstSend) throw new Error(`resend: ${RESEND_OF.campaign} has no sends`);
    openedOriginal = await engagedRecipients(db, firstSend, RESEND_OF.subject);
  }

  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of raw) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    if (seen.has(email)) continue; // the list can hold the same address twice
    // Sprouts Starter buyers are NOT excluded: Seedlings is their next step. Seedlings
    // buyers are. Kit buyers (preorder_broadcast_list) stay excluded, as for every
    // list-announce campaign.
    if (optedOut.has(email) || buyers.has(email) || seedlingsBuyers.has(email) || sent.has(email)) continue;
    if (resendPool && (!resendPool.has(email) || openedOriginal.has(email))) continue;
    if (r.created_at && r.created_at < cutoffIso && !recentlyEngaged.has(email)) continue;
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

  let payload: { mode?: string; to?: string; batch?: number; confirm_campaign?: unknown };
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
      // Type-to-confirm, checked before any recipient is read or claimed.
      const confirm = checkCampaignConfirm(payload.confirm_campaign, CAMPAIGN);
      if (!confirm.ok) {
        return json({ mode, campaign: CAMPAIGN, sent: 0, error: confirm.error }, 400);
      }
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
