// supabase/functions/guide-access-link/index.ts
//
// Emailed access links for the Deep-Dive Guide (founder decision 2026-09-15).
//
//   POST { email, slug }  "Send me my guide link" on /guide/<slug>. If that email
//                         has a paid, unrefunded Deep-Dive Guide order for that
//                         guide, emails https://edeninstitute.health/guide/<slug>?access=<token>
//                         (token valid 7 days). ALWAYS answers {"ok":true}, purchase
//                         or not, so it cannot be used to learn who bought.
//                         Rate limited per IP and per email, 5 an hour each.
//   POST { token }        The guide page opening such a link. Returns
//                         { ok: true, slug, expires_at, guide } for a valid token on
//                         an order that is still live, else { ok: false }.
//
// WHERE PURCHASES LIVE. public.orders, written by stripe-webhook recordDigitalOrder:
// lookup_key = 'deep_dive_guide', customer_email, and the guide in
// raw->metadata->>constitution_nickname ("The Frozen Knot"). There is no slug column
// and metadata carries no slug, so the slug is mapped to its nickname through the
// guide registry, the same registry the webhook and verify-session resolve with.
// Checked read-only 2026-09-15: 7 guide orders (first 2026-07-18), every one with an
// email and a nickname. quiz_completions.purchased_guide is a boolean with no guide
// and no amount, so it cannot answer "which guide did this email buy".
//
// Token logic, routing and the no-enumeration rule live in _shared/guide-access.ts.
//
// verify_jwt = false (config.toml): anonymous visitors on the guide page. CORS is the
// site allowlist (_shared/cors-allowlist.ts), so another site cannot drive it from a
// browser.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, and optionally
// GUIDE_ACCESS_SECRET (token signing; falls back to the service role key).

import { getGuideBySlug } from "../_shared/guide/registry.ts";
import { allowlistCorsHeaders } from "../_shared/cors-allowlist.ts";
import { bumpRateBucket, clientIp } from "../_shared/rate-bucket.ts";
import { escapeLikePattern } from "../_shared/like-escape.ts";
import {
  GUIDE_LINK_SUBJECT,
  GUIDE_LINK_WINDOW_SECONDS,
  guideLinkEmailHtml,
  handleLinkRequest,
  handleVerify,
  parseGuideAccessBody,
} from "../_shared/guide-access.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function corsFor(req: Request): Record<string, string> {
  return { ...allowlistCorsHeaders(req, "POST, OPTIONS"), "Access-Control-Allow-Headers": ALLOW_HEADERS };
}

const dbHeaders = () => ({
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
});

const LIVE_STATUSES_EXCLUDED = "(refunded,cancelled)";

async function findOrder(email: string, slug: string): Promise<string | null> {
  const guide = getGuideBySlug(slug);
  if (!guide) return null;
  const params = new URLSearchParams({
    select: "id",
    lookup_key: "eq.deep_dive_guide",
    // ilike with LIKE wildcards escaped: case-insensitive exact match, since the
    // webhook stores the address as Stripe gave it.
    customer_email: `ilike.${escapeLikePattern(email)}`,
    "raw->metadata->>constitution_nickname": `eq.${guide.nickname}`,
    status: `not.in.${LIVE_STATUSES_EXCLUDED}`,
    order: "created_at.desc",
    limit: "1",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?${params}`, { headers: dbHeaders() });
  if (!res.ok) {
    console.error("guide-access-link: order lookup failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

async function orderStillValid(orderId: string): Promise<boolean> {
  const params = new URLSearchParams({
    select: "id",
    id: `eq.${orderId}`,
    lookup_key: "eq.deep_dive_guide",
    status: `not.in.${LIVE_STATUSES_EXCLUDED}`,
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?${params}`, { headers: dbHeaders() });
  if (!res.ok) {
    console.error("guide-access-link: order re-check failed", res.status);
    return false;
  }
  const rows = (await res.json()) as unknown[];
  return rows.length === 1;
}

async function sendLink(email: string, url: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("guide-access-link: RESEND_API_KEY missing; link not sent");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Camila at The Eden Institute <hello@edeninstitute.health>",
      reply_to: "hello@edeninstitute.health",
      to: [email],
      subject: GUIDE_LINK_SUBJECT,
      html: guideLinkEmailHtml(url),
      tags: [{ name: "category", value: "guide_access_link" }],
    }),
  });
  if (!res.ok) console.error("guide-access-link: Resend failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

// Send after responding where the edge runtime supports it, so a purchase does not
// make the response measurably slower than no purchase.
async function defer(work: Promise<unknown>): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === "function") {
    rt.waitUntil(work);
    return;
  }
  await work;
}

function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsFor(req) });
  if (req.method !== "POST") return json(req, 405, { error: "POST only" });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("guide-access-link: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json(req, 500, { error: "Server misconfigured" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "Invalid request" });
  }

  const parsed = parseGuideAccessBody(body, (slug) => getGuideBySlug(slug) !== null);

  if (parsed.mode === "invalid") return json(req, 400, { error: "Please enter a valid email address." });

  if (parsed.mode === "verify") {
    const r = await handleVerify(parsed.token, { orderStillValid, getGuide: getGuideBySlug });
    return json(req, r.status, r.body);
  }

  const r = await handleLinkRequest(
    { email: parsed.email, slug: parsed.slug, ip: clientIp(req) },
    {
      bump: (key) =>
        bumpRateBucket({
          supabaseUrl: SUPABASE_URL,
          serviceKey: SUPABASE_SERVICE_ROLE_KEY,
          key,
          windowSeconds: GUIDE_LINK_WINDOW_SECONDS,
        }),
      findOrder,
      sendLink,
      defer,
    },
  );
  return json(req, r.status, r.body);
});
