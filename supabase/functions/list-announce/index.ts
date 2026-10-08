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
import { tagEmailHtml } from "../_shared/email-utm.ts";
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
// 2026-09-28 resend ("seedlings_live_resend_2026_09_28") was built but NEVER SENT.
// 2026-10-08: Chamomile week, founder "it has been too long". Sprouts Week 2 shown
// Mon-Fri off the real Teacher's Guide (printed pp. 19-24). Copy approved in session;
// Word copy: Email Journeys and Nurture/List_Email_Chamomile_Week_2026-10-08.docx.
// 2026-10-08 SENT: 1,029, 0 failed. 2026-10-12: its ONE resend to non-openers, new
// subject (founder pick 2026-10-08: "The tiny daisy that smells like apples").
const CAMPAIGN = "chamomile_week_resend_2026_10_12";

// When set, this campaign goes ONLY to people who received RESEND_OF and have no
// open or click on it (matched by that email's exact subject, so opening some
// other email does not count). Set to null for an ordinary new campaign.
const RESEND_OF: { campaign: string; subject: string } | null = {
  campaign: "chamomile_week_2026_10_08",
  subject: "A cup of chamomile with your kids this week",
};

// Founder decision 2026-09-24: anyone who joined more than 90 days ago and has not
// opened or clicked ANY email in the last 90 days stops getting list blasts. They
// stay on the list and nothing is unsubscribed; opening any email brings them back.
const DORMANT_DAYS = 90;

// Founder's pick, 2026-09-24. The original's subject was "Seedlings is live (and
// you're the first to know)".
const SUBJECT = "The tiny daisy that smells like apples";

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
 * Chamomile week, to the homeschool list, 2026-10-08 (founder: "it has been too long").
 *
 * Every line about the week was read off the Sprouts Teacher's Guide, Week 2, printed
 * pages 19-24 (week at a glance, Kitchen Lab steps, Bear moment allergy note, Thursday
 * Egypt lesson, chant). Links checked live 2026-10-08: /starter/sprouts ($39, 9 weeks),
 * /freebies (Sprouts Week 1 free), /tales-and-table-talk, and the Roaming Mama episode on
 * Apple Podcasts (Lynn cleared sharing 2026-09-18). No em dashes.
 */
function buildAnnouncement(firstName: string): string {
  const ROAMING_MAMA =
    "https://podcasts.apple.com/us/podcast/learning-to-notice-faith-nature-the-joy-of-homeschooling/id1873324343?i=1000790934719";
  const day = (d: string, t: string) => p(`<strong>${d}:</strong> ${t}`, "margin:0 0 10px 0;");
  const body =
    preheader(`One plant, five days, and a podcast for you while you fold laundry.`) +
    p(`Hi ${firstName},`) +
    (RESEND_OF
      ? p(`Sending this one more time in case it got buried in your inbox! Here is one real week of Eden&rsquo;s Table, the way it looks at a kitchen table.`)
      : p(`It has been a few weeks since I wrote, and I have missed you!! So here is one real week of Eden&rsquo;s Table, the way it looks at a kitchen table.`)) +
    p(`<strong>Week 2 of Sprouts is chamomile</strong>, the tiny daisy that smells like apples.`) +
    day("Monday", `read &ldquo;Life Force,&rdquo; the story of how Gracie&rsquo;s cut heals by God&rsquo;s design, and meet chamomile.`) +
    day("Tuesday", `look close and sketch the little daisy.`) +
    day("Wednesday", `Kitchen Lab. Steep 1 teaspoon of dried chamomile flowers in a mug of hot water for 5 minutes, add a little honey, and watch the water turn pale gold. A grown-up handles the hot water. (Chamomile is a daisy cousin, so if anyone reacts to daisies or ragweed, check first.)`) +
    day("Thursday", `travel to the Nile in ancient Egypt, where people loved chamomile as a &ldquo;sun-herb,&rdquo; and paint a page of chamomile suns.`) +
    day("Friday", `go outside, look close at a plant, and review the week together.`) +
    p(`And the chant your kids will be singing all week: <em>&ldquo;Chamomile, a daisy small, gold and gentle, soft and mild.&rdquo;</em>`, "margin:16px 0 16px 0;") +
    brandButton(`Start with the first nine weeks`, `${SITE}/starter/sprouts`) +
    p(`That is the ${textLink(`Sprouts Starter Unit, ${STARTER_PRICE}`, `${SITE}/starter/sprouts`)}, and it downloads instantly. Not ready yet? ${textLink("Grab Week 1 free", `${SITE}/freebies`)}, all five days.`) +
    p(`<strong>Something just for you:</strong> I was a guest on The Roaming Mama Podcast talking about faith, nature and the joy of homeschooling. ${textLink("Listen here", ROAMING_MAMA)}. It is a good one for folding laundry.`) +
    signature("In Him,") +
    p(`P.S. I am starting a read-aloud podcast for you and your kids, <em>Tales and Table Talk</em>. It launches in January. ${textLink("Get on the list here", `${SITE}/tales-and-table-talk`)} so you hear the very first episode.`, "margin:24px 0 0 0;");
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
  // 2026-10-08 Chamomile week pitches the Sprouts Starter: leave out anyone who already
  // owns Sprouts (six of them got their Founding Family thank-you the same afternoon).
  const sproutsOwners = await starterBuyers(db, ["sprouts_starter_unit", "sprouts_print_set", "both_bands_print_set"]);

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
    // Sprouts owners are excluded (see sproutsOwners). Kit buyers (preorder_broadcast_list)
    // stay excluded, as for every list-announce campaign.
    if (optedOut.has(email) || buyers.has(email) || sproutsOwners.has(email) || sent.has(email)) continue;
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
  const { html: unsubHtml, headers } = await applyUnsub(buildAnnouncement(firstName), to, "homeschool");
  // UTM tags on every edeninstitute.health link (founder rule 2026-10-08, _shared/email-utm.ts).
  const html = tagEmailHtml(unsubHtml, { medium: "newsletter", content: "list_announce", campaign: CAMPAIGN });
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
