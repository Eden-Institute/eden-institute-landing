// founder-broadcast — reach the preorder cohort.
//
// Modes (POST JSON { mode, ... }):
//   preview  → render the email and report the recipient count. Sends nothing.
//   send     → send an update to every live preorder buyer
//   delay    → send an FTC delay notice, recording per-order evidence and consent links
//   pending  → list opt-in notices whose 30-day window has closed and who never replied
//
// Gate: founder email, same boundary as the founder_* read RPCs. verify_jwt stays true.
//
// Why preview exists as a first-class mode: this sends to every buyer at once and there
// is no unsend. A dry run that renders the real HTML against the real recipient count is
// the cheapest possible guard against a typo going out to the whole founding cohort.
//
// Delay notices are legal instruments, not marketing. See _shared/broadcast-templates.ts
// for how 16 CFR 435.2(b) maps onto the copy, and the migration for why per-order rows
// exist. The rule the code enforces here: a slip of MORE than 30 days past the stated
// date, an indefinite slip, or ANY second notice to the same order, requires opt-in
// (silence = cancellation). Anything else may use opt-out.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "../_shared/sentry.ts";
import { buildDelayNoticeEmail, buildUpdateEmail, renderBody } from "../_shared/broadcast-templates.ts";
import { signDelayToken } from "../_shared/delay-consent-token.ts";
import { requiresOptIn } from "../_shared/delay-notice-rules.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE = "https://edeninstitute.health";

const FOUNDER_EMAIL = "hello@edeninstitute.health";
const FROM = "Camila at The Eden Institute <hello@edeninstitute.health>";

// Delay-notice subject lines are PRE-APPROVED, not typed at send time.
//
// Every other word of a delay notice is templated because the notice is a legal
// instrument under 16 CFR 435.2(b). The subject was the one part still freehand, and
// it would be written in the worst circumstances: late, under pressure, on the day a
// shipment slips. It is also the first place the opt-in / opt-out distinction becomes
// visible to the buyer, and those two carry opposite consequences.
//
// Opt-out: silence is consent, the order stands. "Update" is honest.
// Opt-in:  silence is CANCELLATION and refund. The subject must say that action is
//          required, or a buyer who skims loses their order by doing nothing.
//
// No response deadline in the opt-in subject on purpose. Nothing in this system
// computes or enforces one, and a date in a subject line that no code honours is the
// same defect as telling a buyer a refund is "on its way" when it is issued by hand.
const DELAY_SUBJECT_OPT_OUT = "Update on your Eden's Table order: new ship date inside";
const DELAY_SUBJECT_OPT_IN = "Action needed on your Eden's Table order, please reply to keep it";

/** Delay notices use their approved subject; ordinary updates keep the founder's. */
function resolveSubject(isDelay: boolean, optIn: boolean, founderSubject: string): string {
  if (!isDelay) return founderSubject;
  return optIn ? DELAY_SUBJECT_OPT_IN : DELAY_SUBJECT_OPT_OUT;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);

interface Recipient {
  order_id: string;
  customer_email: string;
  shipping_name: string | null;
  order_number: string | null;
}

/** PostgREST returns at most `max-rows` (1000 on this project) per request, silently.
 *  Every list here must be paged, and the pages must be ordered by a stable key or rows
 *  can repeat and others go missing between requests. */
const PAGE = 500;

/** Live preorder buyers. The view already excludes cancelled and refunded orders and
 *  deliberately keeps shipped ones, so the founding cohort stays intact after delivery.
 *
 *  PAGED, and that is not a nicety. Before this, the query had no .limit() and no
 *  pagination, so PostgREST capped it at 1000 rows. The button label, the confirmation
 *  dialog, and the send loop all read from that same truncated array, so at 1,400
 *  preorders the UI would say "Send to 1000", report "Sent to 1000 of 1000", and 400
 *  buyers would never receive a legally required delay notice -- with no evidence row, so
 *  delay_notices_awaiting_action would never flag them either. Plausible, reassuring, and
 *  wrong. Stock is capped at 1000 kits PLUS 1000 notebooks, so crossing that line is the
 *  plan, not an edge case. */
async function recipients(db: ReturnType<typeof admin>): Promise<Recipient[]> {
  const rows: Array<Omit<Recipient, "order_number">> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("preorder_broadcast_list")
      .select("order_id, customer_email, shipping_name")
      .order("order_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as Array<Omit<Recipient, "order_number">>;
    rows.push(...page);
    // A short page means the end. Equal-to-PAGE means there may be more.
    if (page.length < PAGE) break;
  }

  // order_number lives on orders, not the view. Absent before that migration lands,
  // so treat it as optional rather than failing the whole send.
  // Chunked for the same reason: .in() with 1400 ids would also be capped at 1000
  // results, which would silently blank order numbers on the overflow.
  const numbers = new Map<string, string>();
  const ids = rows.map((r) => r.order_id);
  for (let i = 0; i < ids.length; i += PAGE) {
    const { data: ord } = await db
      .from("orders")
      .select("id, order_number")
      .in("id", ids.slice(i, i + PAGE));
    for (const o of (ord ?? []) as Array<{ id: string; order_number?: string | null }>) {
      if (o.order_number) numbers.set(o.id, o.order_number);
    }
  }

  return rows
    .filter((r) => !!r.customer_email)
    .map((r) => ({ ...r, order_number: numbers.get(r.order_id) ?? null }));
}

/** Send attempts allowed per hour. A real send is one; a real correction is two. */
const SEND_LIMIT = Number(Deno.env.get("BROADCAST_SEND_LIMIT") ?? "3");
const SEND_WINDOW_SECONDS = Number(Deno.env.get("BROADCAST_SEND_WINDOW_SECONDS") ?? "3600");

/** FAILS CLOSED, unlike the checkout limiter. There, blocking a real buyer costs more
 *  than the abuse it prevents. Here the asymmetry is reversed: a refused send is a button
 *  pressed again in a minute; an unintended delay notice is refund liability across the
 *  whole cohort, and it cannot be recalled. */
async function underSendLimit(
  db: ReturnType<typeof admin>,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("broadcast_rate_bump", {
      p_key: userId,
      p_window_seconds: SEND_WINDOW_SECONDS,
    });
    if (error || typeof data !== "number") {
      console.error("broadcast rate limit unavailable, refusing send:", error?.message);
      return false;
    }
    return data <= SEND_LIMIT;
  } catch (e) {
    console.error("broadcast rate limit threw, refusing send:", e);
    return false;
  }
}

function firstName(name: string | null): string {
  const n = (name ?? "").trim().split(/\s+/)[0];
  return n || "there";
}

async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, reply_to: FOUNDER_EMAIL, subject, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json().catch(() => ({}));
  return typeof body?.id === "string" ? body.id : null;
}

/** Human date for the copy, in the founder's timezone rather than UTC. */
function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);
    if ((user.email ?? "").toLowerCase() !== FOUNDER_EMAIL) {
      return json({ error: "founder_only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? "preview");
    const db = admin();

    if (mode === "pending") {
      const { data, error } = await db.rpc("delay_notices_awaiting_action");
      if (error) throw error;
      return json({ pending: data ?? [] });
    }

    const subject = String(body.subject ?? "").trim().slice(0, 200);
    const bodyMarkdown = String(body.body_markdown ?? "").trim().slice(0, 20_000);
    if (!subject || !bodyMarkdown) return json({ error: "subject_and_body_required" }, 400);

    const list = await recipients(db);

    if (mode === "preview") {
      const sample = list[0];
      const isDelay = body.kind === "delay_notice";
      const revised = body.revised_ship_date ? String(body.revised_ship_date) : null;
      const optIn = requiresOptIn({
        revisedShipDate: revised,
        currentShipsOn: String(body.current_ships_on ?? "") || null,
        priorNoticeCount: 0,
      });
      const html = isDelay
        ? buildDelayNoticeEmail({
          firstName: firstName(sample?.shipping_name ?? null),
          bodyMarkdown,
          revisedShipDate: revised ? formatDate(revised) : null,
          requiresOptIn: optIn,
          consentUrl: `${SITE}/preorder-response?token=SAMPLE`,
          cancelUrl: `${SITE}/preorder-response?token=SAMPLE`,
          orderNumber: sample?.order_number ?? "ET-1001",
        })
        : buildUpdateEmail({
          firstName: firstName(sample?.shipping_name ?? null),
          bodyMarkdown,
          orderNumberLine: sample?.order_number ? `Order ${sample.order_number}` : undefined,
        });
      // Preview must show the subject that will actually send, not the one typed in.
      return json({ recipient_count: list.length, subject: resolveSubject(isDelay, optIn, subject), html });
    }

    if (mode !== "send" && mode !== "delay") return json({ error: "unknown_mode" }, 400);
    if (!list.length) return json({ error: "no_recipients" }, 409);

    // Required, not optional. An idempotency key the caller may omit protects nobody,
    // because the dangerous caller is the one that omits it.
    const idempotencyKey = String(body.idempotency_key ?? "").trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      return json({ error: "idempotency_key_required" }, 400);
    }

    if (!(await underSendLimit(db, user.id))) {
      return json({ error: "rate_limited", limit: SEND_LIMIT }, 429);
    }

    const isDelay = mode === "delay";
    const revised = body.revised_ship_date ? String(body.revised_ship_date) : null;
    const currentShipsOn = String(body.current_ships_on ?? "") || null;

    // Dates reach the copy through formatDate(); a malformed one renders the literal
    // string "Invalid Date" into a legal notice. Reject rather than mail that.
    if (revised !== null && !/^\d{4}-\d{2}-\d{2}$/.test(revised)) {
      return json({ error: "invalid_revised_ship_date" }, 400);
    }

    const optIn = isDelay
      ? requiresOptIn({ revisedShipDate: revised, currentShipsOn, priorNoticeCount: 0 })
      : false;
    // A delay notice always mails its approved subject, whatever was typed in the tab.
    const sendSubject = resolveSubject(isDelay, optIn, subject);

    const { data: bc, error: bcErr } = await db.from("broadcasts").insert({
      kind: isDelay ? "delay_notice" : "update",
      subject: sendSubject,
      body_markdown: bodyMarkdown,
      body_html: isDelay ? null : renderBody(bodyMarkdown),
      revised_ship_date: revised,
      requires_opt_in: optIn,
      created_by: user.id,
      idempotency_key: idempotencyKey,
    }).select("id").single();

    // 23505 on the idempotency index means this exact message was already sent. Report
    // the original broadcast rather than mailing the cohort a second time. This is the
    // whole point: the retry path must be indistinguishable from success to the caller,
    // and must send nothing.
    if (bcErr) {
      if ((bcErr as { code?: string }).code === "23505") {
        const { data: prior } = await db
          .from("broadcasts")
          .select("id, sent_count, failed_count")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        console.log(`duplicate broadcast suppressed for key ${idempotencyKey}`);
        return json({
          broadcast_id: prior?.id ?? null,
          sent: prior?.sent_count ?? 0,
          failed: prior?.failed_count ?? 0,
          total: prior?.sent_count ?? 0,
          duplicate: true,
        });
      }
      throw bcErr;
    }
    const broadcastId = bc.id as string;

    let sent = 0;
    let failed = 0;
    for (const r of list) {
      try {
        let html: string;
        if (isDelay) {
          // Per-order opt-in determination: an order that has already had a notice
          // always requires affirmative consent, regardless of this slip's size.
          const { count } = await db
            .from("order_delay_notices")
            .select("id", { count: "exact", head: true })
            .eq("order_id", r.order_id);
          const optIn = requiresOptIn({
            revisedShipDate: revised,
            currentShipsOn,
            priorNoticeCount: count ?? 0,
          });

          const [consentTok, cancelTok] = await Promise.all([
            signDelayToken({ o: r.order_id, b: broadcastId, r: "consented" }),
            signDelayToken({ o: r.order_id, b: broadcastId, r: "cancelled" }),
          ]);
          html = buildDelayNoticeEmail({
            firstName: firstName(r.shipping_name),
            bodyMarkdown,
            revisedShipDate: revised ? formatDate(revised) : null,
            requiresOptIn: optIn,
            consentUrl: `${SITE}/preorder-response?token=${consentTok}`,
            cancelUrl: `${SITE}/preorder-response?token=${cancelTok}`,
            orderNumber: r.order_number,
          });
          // Evidence row FIRST: a sent notice we failed to record is worse than a
          // recorded notice we failed to send, because only the former is invisible.
          await db.from("order_delay_notices").insert({
            order_id: r.order_id,
            broadcast_id: broadcastId,
            notice_number: (count ?? 0) + 1,
            revised_ship_date: revised,
            requires_opt_in: optIn,
          });
        } else {
          html = buildUpdateEmail({
            firstName: firstName(r.shipping_name),
            bodyMarkdown,
            orderNumberLine: r.order_number ? `Order ${r.order_number}` : undefined,
          });
        }
        await sendEmail(r.customer_email, sendSubject, html);
        sent += 1;
      } catch (e) {
        failed += 1;
        console.error(`broadcast to ${r.customer_email} failed:`, e instanceof Error ? e.message : String(e));
        await captureException(e, { function: "founder-broadcast", order_id: r.order_id });
      }
    }

    await db.from("broadcasts")
      .update({ sent_at: new Date().toISOString(), sent_count: sent, failed_count: failed })
      .eq("id", broadcastId);

    return json({ broadcast_id: broadcastId, sent, failed, total: list.length });
  } catch (err) {
    console.error("founder-broadcast error:", err);
    await captureException(err, { function: "founder-broadcast" });
    return json({ error: "server_error" }, 500);
  }
});
