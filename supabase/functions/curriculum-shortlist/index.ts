// curriculum-shortlist: "Email me my shortlist" on /curriculum-finder (2026-11-19, Camila's taps:
// public finder, the email unlocks her saved shortlist PDF, plus an UNTICKED box to join the Friday email).
//
// POST { email, first_name?, ids: uuid[] (1-30), friday_opt_in?: boolean, esa_state?: "TX", attribution?, website? }
// -> records the request (curriculum_shortlists) -> builds the shortlist PDF from the approved finder rows
// -> emails it (transactional: she asked for it; Idempotency-Key per request)
// -> ONLY if she ticked the box: adds her to the homeschool list the Friday email goes to
//    (waitlist_signups, entry_funnel edens_table, source curriculum_finder). Written directly, NOT through
//    resend-waitlist, which sends a welcome email; the old insert trigger is a retired no-op, and the
//    free-week catch-up segments skip this source (migration 20261120..._curriculum_finder).
// Public (verify_jwt = false): honeypot field, rate limits per IP and per email, ids must be approved rows.
// ⚠️ The email copy here is DRAFT, PENDING Camila's approval on the finder review page.

import { bumpRateBucket, clientIp } from "../_shared/rate-bucket.ts";
import { buildShortlistPdf, type FinderRow } from "../_shared/wired-pdf.ts";
import { BRAND, emailShell } from "../_shared/nurture-email-templates.ts";
import { tagEmailHtml } from "../_shared/email-utm.ts";
import { cleanContactEmail } from "../_shared/contact-email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FROM = "Camila at The Eden Institute <hello@edeninstitute.health>";
const REPLY_TO = FROM.slice(FROM.indexOf("<") + 1, FROM.indexOf(">"));
const ADDRESS = "Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043";
const IP_PER_HOUR = 20;
const EMAIL_PER_HOUR = 5;

/** DRAFT copy, pending Camila's approval. */
export const SHORTLIST_EMAIL = {
  subject: "Your curriculum shortlist",
  preview: "Your PDF is attached, with every free sample link.",
  greeting: (first: string | null) => (first ? `Hi ${first},` : "Hi,"),
  body: [
    "Here's the shortlist you made on our curriculum finder. Your PDF is attached, with each curriculum's free sample link and what other moms say about it.",
    "Trying a free sample is the fastest way to see what fits your family. Pick one or two this week and do a lesson together.",
  ],
  button: "Back to the curriculum finder",
  buttonUrl: "https://edeninstitute.health/curriculum-finder?utm_source=email&utm_medium=email&utm_campaign=curriculum_finder&utm_content=shortlist",
  quiz: "Not sure which one fits your child? Our free Fearfully & Wonderfully Wired quiz shows how God wired your child and which curricula fit them best.",
  footer: "You're getting this because you asked for your shortlist on edeninstitute.health.",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function buildShortlistEmail(firstName: string | null): { subject: string; html: string; text: string } {
  const p = (s: string) => `<p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};">${esc(s)}</p>`;
  const button = `<p style="margin:8px 0 24px 0;text-align:center;"><a href="${esc(SHORTLIST_EMAIL.buttonUrl)}" style="display:inline-block;background:#2C3E2D;color:#FFFFFF;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px;">${esc(SHORTLIST_EMAIL.button)}</a></p>`;
  const html = emailShell(
    `<span style="display:none;max-height:0;overflow:hidden;">${esc(SHORTLIST_EMAIL.preview)}</span>` +
      p(SHORTLIST_EMAIL.greeting(firstName)) + SHORTLIST_EMAIL.body.map(p).join("") + button + p(SHORTLIST_EMAIL.quiz) +
      `<p style="margin:24px 0 0 0;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Camila</p>` +
      `<p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:14px;">The Eden Institute</p>`,
    `<tr><td style="font-family:Georgia,serif;font-size:12px;color:${BRAND.footerOnForest};text-align:center;">${esc(SHORTLIST_EMAIL.footer)}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:${BRAND.footerOnForest};text-align:center;padding-top:6px;">${ADDRESS}</td></tr>`,
    { shopCard: false },
  );
  const text = [SHORTLIST_EMAIL.greeting(firstName), ...SHORTLIST_EMAIL.body, `${SHORTLIST_EMAIL.button}: ${SHORTLIST_EMAIL.buttonUrl}`, SHORTLIST_EMAIL.quiz, "Camila", "The Eden Institute", "", SHORTLIST_EMAIL.footer, ADDRESS.replace("&middot;", "·")].join("\n\n");
  return { subject: SHORTLIST_EMAIL.subject, html: tagEmailHtml(html, { medium: "nurture", campaign: "curriculum_finder", content: "shortlist" }), text };
}

async function rest<T>(url: string, key: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const t = await res.text();
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${t.slice(0, 200)}`);
  return (t ? JSON.parse(t) : null) as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json(400, { error: "invalid", message: "Something went wrong. Please try again." });
  if (typeof body.website === "string" && body.website.trim()) return json(200, { ok: true }); // honeypot: pretend success

  const email = cleanContactEmail(typeof body.email === "string" ? body.email : null);
  if (!email) return json(400, { error: "bad_email", message: "Please check your email address." });
  const firstName = typeof body.first_name === "string" && body.first_name.trim() ? body.first_name.trim().slice(0, 60) : null;
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))] : [];
  if (ids.length < 1 || ids.length > 30) return json(400, { error: "bad_ids", message: "Star between 1 and 30 curricula first." });
  const esaState = typeof body.esa_state === "string" && /^[A-Za-z]{2}$/.test(body.esa_state) ? body.esa_state.toUpperCase() : null;
  const optIn = body.friday_opt_in === true;

  const ip = clientIp(req);
  const [ipCount, emailCount] = await Promise.all([
    ip ? bumpRateBucket({ supabaseUrl: url, serviceKey: key, key: `shortlist:ip:${ip}`, windowSeconds: 3600 }) : Promise.resolve(null),
    bumpRateBucket({ supabaseUrl: url, serviceKey: key, key: `shortlist:email:${email.toLowerCase()}`, windowSeconds: 3600 }),
  ]);
  if ((ipCount ?? 0) > IP_PER_HOUR || (emailCount ?? 0) > EMAIL_PER_HOUR) {
    return json(429, { error: "too_many", message: "That's a lot of shortlists in an hour. Please try again a little later." });
  }

  try {
    const all = await rest<(FinderRow & { id: string })[]>(url, key, "rpc/curriculum_finder_list", { method: "POST", body: "{}" });
    const byId = new Map(all.map((r) => [r.id, r]));
    const items = ids.map((id) => byId.get(id)).filter((r): r is FinderRow & { id: string } => !!r);
    if (!items.length) return json(400, { error: "bad_ids", message: "Those curricula aren't in the finder anymore. Please refresh the page." });

    const attribution = body.attribution && typeof body.attribution === "object" ? Object.fromEntries(
      Object.entries(body.attribution as Record<string, unknown>).filter(([k, v]) => /^[a-z_]{1,40}$/.test(k) && typeof v === "string").map(([k, v]) => [k, (v as string).slice(0, 200)]),
    ) : {};
    const [row] = await rest<{ id: string }[]>(url, key, "curriculum_shortlists", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ email: email.toLowerCase(), first_name: firstName, curriculum_ids: items.map((i) => i.id), friday_opt_in: optIn, esa_state: esaState, attribution }),
    });

    // Friday email: only with her tick, never through resend-waitlist (that sends a welcome).
    if (optIn) {
      try {
        await rest(url, key, "waitlist_signups?on_conflict=email,entry_funnel", {
          method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify({
            email: email.toLowerCase(), first_name: firstName, entry_funnel: "edens_table", source: "curriculum_finder",
            source_url: "https://edeninstitute.health/curriculum-finder",
            consents: { friday_email: true, at: new Date().toISOString(), via: "curriculum_finder_checkbox" },
            utm_source: typeof attribution.utm_source === "string" ? attribution.utm_source : null,
            utm_medium: typeof attribution.utm_medium === "string" ? attribution.utm_medium : null,
            utm_campaign: typeof attribution.utm_campaign === "string" ? attribution.utm_campaign : null,
          }),
        });
      } catch (err) {
        console.error("curriculum-shortlist: Friday list add failed:", err instanceof Error ? err.message : String(err));
      }
    }

    const pdf = await buildShortlistPdf({ items, esaState });
    const mail = buildShortlistEmail(firstName);
    if (!resendKey) throw new Error("RESEND_API_KEY is not set");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `shortlist-${row.id}` },
      body: JSON.stringify({
        from: FROM, reply_to: REPLY_TO, to: [email], subject: mail.subject, html: mail.html, text: mail.text,
        attachments: [{ filename: "Curriculum-Shortlist.pdf", content: b64(pdf) }],
        tags: [{ name: "category", value: "curriculum_shortlist" }],
      }),
    });
    const sent = await res.json().catch(() => ({})) as { id?: string; message?: string };
    if (!res.ok) {
      await rest(url, key, `curriculum_shortlists?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_error: `Resend ${res.status}: ${String(sent.message ?? "").slice(0, 200)}` }) });
      return json(502, { error: "send_failed", message: "We couldn't send it just now. Please try again in a minute." });
    }
    await rest(url, key, `curriculum_shortlists?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sent_at: new Date().toISOString(), resend_id: sent.id ?? null }) });
    return json(200, { ok: true, count: items.length });
  } catch (err) {
    console.error("curriculum-shortlist:", err instanceof Error ? err.message : String(err));
    return json(500, { error: "failed", message: "Something went wrong. Please try again in a minute." });
  }
});
