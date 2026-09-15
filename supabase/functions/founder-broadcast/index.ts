// founder-broadcast — reach the preorder cohort.
//
// Modes (POST JSON { mode, ... }):
//   preview  → render the email and report the recipient count. Sends nothing.
//   send     → send an update to every live preorder buyer
//   delay    → send an FTC delay notice, recording per-order evidence and consent links
//
// RESUMING (2026-09-16): send and delay record every order in
// broadcast_recipient_sends the moment Resend accepts its email, in batches under a
// time budget. Pressing Send again with the same message (same idempotency_key) mails
// ONLY the orders not yet logged, never anyone twice. The reply carries sent (total with
// this message), sent_now, already_sent, failed and total; while anything is left over it
// answers 409 with a plain `error` telling the founder to press Send again, which keeps
// the dashboard's key and form so the next press resumes. A key reused for an edited
// message is refused. Broadcasts sent before the log existed keep the old duplicate answer.
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
import { requiresOptIn, resolveSubject } from "../_shared/delay-notice-rules.ts";
import {
  broadcastMatches,
  isStaleClaim,
  planResume,
  type SendLogRow,
  summarizeSend,
} from "../_shared/broadcast-resume.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE = "https://edeninstitute.health";

const FOUNDER_EMAIL = "hello@edeninstitute.health";
const FROM = "Camila at The Eden Institute <hello@edeninstitute.health>";

// Delay-notice subject lines are PRE-APPROVED: see DELAY_SUBJECT_* and resolveSubject
// in _shared/delay-notice-rules.ts.

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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string,
): Promise<string | null> {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // Resend answers a repeated key (kept 24h) with the original response and
        // does not send again, so a retry here cannot deliver the same email twice.
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from: FROM, to, reply_to: FOUNDER_EMAIL, subject, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429 && attempt < 2) {
      await res.body?.cancel();
      const waitMs = Math.min(Number(res.headers.get("retry-after")) * 1000 || 1000 * (attempt + 1), 5000);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json().catch(() => ({}));
    return typeof body?.id === "string" ? body.id : null;
  }
}

// ── Resumable sends (2026-09-16) ────────────────────────────────────────────
// See _shared/broadcast-resume.ts for the design. The database side:
// broadcast_recipient_sends holds one row per (idempotency key, email, order),
// 'sending' while claimed and 'sent' with the Resend message id once accepted.

/** Stop picking up new recipients after this, well inside the edge worker's wall clock. */
const RUN_BUDGET_MS = 100_000;
/** Recipients per batch; broadcasts.sent_count is brought up to date after each one. */
const SEND_BATCH = 25;
/** Spacing between Resend calls, to stay under its per-second rate limit. */
const SEND_SPACING_MS = 300;

const BROADCAST_COLUMNS = "id, kind, subject, body_markdown, revised_ship_date, sent_count, failed_count, recipient_log";

interface BroadcastRow {
  id: string;
  kind: string;
  subject: string;
  body_markdown: string;
  revised_ship_date: string | null;
  sent_count: number | null;
  failed_count: number | null;
  recipient_log: boolean | null;
}

const normEmail = (e: string) => e.trim().toLowerCase();

async function findBroadcast(db: ReturnType<typeof admin>, key: string): Promise<BroadcastRow | null> {
  const { data, error } = await db.from("broadcasts").select(BROADCAST_COLUMNS).eq("idempotency_key", key).maybeSingle();
  if (error) throw error;
  return (data as BroadcastRow | null) ?? null;
}

/** Every log row for this message, paged (PostgREST caps a response at 1000 rows). */
async function sendLog(db: ReturnType<typeof admin>, key: string): Promise<SendLogRow[]> {
  const out: SendLogRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("broadcast_recipient_sends")
      .select("order_id, recipient_email, status, claimed_at")
      .eq("idempotency_key", key)
      .order("order_id", { ascending: true })
      .order("recipient_email", { ascending: true })
      .range(from, from + PAGE - 1);
    // A log we cannot read must stop the send: guessing "nobody has it" mails everyone twice.
    if (error) throw error;
    const page = (data ?? []) as SendLogRow[];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

type RecipientClaim =
  | { kind: "owned"; claimedAt: string }
  | { kind: "already_sent" }
  | { kind: "in_flight" }
  | { kind: "error"; detail: string };

/** Claim one order for this message BEFORE mailing it. Never throws. */
async function claimRecipient(
  db: ReturnType<typeof admin>,
  broadcastId: string,
  key: string,
  r: Recipient,
): Promise<RecipientClaim> {
  const email = normEmail(r.customer_email);
  const claimedAt = new Date().toISOString();
  try {
    const { error } = await db.from("broadcast_recipient_sends").insert({
      broadcast_id: broadcastId,
      idempotency_key: key,
      order_id: r.order_id,
      recipient_email: email,
      status: "sending",
      claimed_at: claimedAt,
    });
    if (!error) return { kind: "owned", claimedAt };
    if ((error as { code?: string }).code !== "23505") return { kind: "error", detail: `claim: ${error.message}` };

    // A row exists: sent, claimed by a live request, or left by one that died.
    const { data: row, error: readErr } = await db
      .from("broadcast_recipient_sends")
      .select("status, claimed_at")
      .eq("idempotency_key", key).eq("order_id", r.order_id).eq("recipient_email", email)
      .maybeSingle();
    if (readErr || !row) return { kind: "error", detail: `claim re-read: ${readErr?.message ?? "row vanished"}` };
    if (row.status === "sent") return { kind: "already_sent" };
    if (!isStaleClaim(row.claimed_at as string, new Date())) return { kind: "in_flight" };

    // Take over a dead claim, only if nobody else has since.
    const { data: took, error: takeErr } = await db
      .from("broadcast_recipient_sends")
      .update({ claimed_at: claimedAt })
      .eq("idempotency_key", key).eq("order_id", r.order_id).eq("recipient_email", email)
      .eq("status", "sending").eq("claimed_at", row.claimed_at as string)
      .select("order_id");
    if (takeErr) return { kind: "error", detail: `claim takeover: ${takeErr.message}` };
    return Array.isArray(took) && took.length === 1 ? { kind: "owned", claimedAt } : { kind: "in_flight" };
  } catch (e) {
    return { kind: "error", detail: `claim threw: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Resend accepted the email: record it at once. Never throws. */
async function markRecipientSent(
  db: ReturnType<typeof admin>,
  key: string,
  r: Recipient,
  claimedAt: string,
  messageId: string | null,
): Promise<void> {
  try {
    const { error } = await db.from("broadcast_recipient_sends")
      .update({ status: "sent", sent_at: new Date().toISOString(), resend_message_id: messageId })
      .eq("idempotency_key", key).eq("order_id", r.order_id).eq("recipient_email", normEmail(r.customer_email))
      .eq("claimed_at", claimedAt);
    if (error) throw error;
  } catch (e) {
    // The row stays 'sending'. A resume more than STALE_CLAIM_MS later retries it
    // under the same Resend Idempotency-Key, which Resend dedupes for 24 hours.
    const message = e instanceof Error ? e.message : String(e);
    console.error(`founder-broadcast: order ${r.order_id} was sent but not marked sent: ${message}`);
    await captureException(e, { function: "founder-broadcast", stage: "mark-sent", order_id: r.order_id });
  }
}

/** The send failed: drop our claim so a resume retries this order. Never throws. */
async function releaseRecipient(db: ReturnType<typeof admin>, key: string, r: Recipient, claimedAt: string): Promise<void> {
  try {
    const { error } = await db.from("broadcast_recipient_sends").delete()
      .eq("idempotency_key", key).eq("order_id", r.order_id).eq("recipient_email", normEmail(r.customer_email))
      .eq("status", "sending").eq("claimed_at", claimedAt);
    if (error) throw error;
  } catch (e) {
    // Left 'sending': it becomes stale and is retried by a resume anyway.
    console.error(`founder-broadcast: could not release claim for order ${r.order_id}:`, e instanceof Error ? e.message : String(e));
  }
}

/** broadcasts.sent_count from the log (the truth), failed_count for this run. Never throws. */
async function updateProgress(
  db: ReturnType<typeof admin>,
  broadcastId: string,
  key: string,
  failed: number,
  complete: boolean,
): Promise<void> {
  try {
    const { count, error } = await db.from("broadcast_recipient_sends")
      .select("order_id", { count: "exact", head: true })
      .eq("idempotency_key", key).eq("status", "sent");
    if (error) throw error;
    const patch: Record<string, unknown> = { sent_count: count ?? 0, failed_count: failed };
    if (complete) patch.sent_at = new Date().toISOString();
    const { error: upErr } = await db.from("broadcasts").update(patch).eq("id", broadcastId);
    if (upErr) throw upErr;
  } catch (e) {
    console.error(`founder-broadcast: progress update for ${broadcastId} failed:`, e instanceof Error ? e.message : String(e));
  }
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

    // Dates reach the copy through formatDate(); a malformed one renders the literal
    // string "Invalid Date" into a legal notice. Reject rather than mail (or preview) that.
    const revisedRaw = body.revised_ship_date ? String(body.revised_ship_date) : null;
    if (revisedRaw !== null && !/^\d{4}-\d{2}-\d{2}$/.test(revisedRaw)) {
      return json({ error: "invalid_revised_ship_date" }, 400);
    }

    const list = await recipients(db);

    if (mode === "preview") {
      const sample = list[0];
      const isDelay = body.kind === "delay_notice";
      const revised = revisedRaw;
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

    const isDelay = mode === "delay";
    const kind = isDelay ? "delay_notice" : "update";
    const revised = revisedRaw;
    const currentShipsOn = String(body.current_ships_on ?? "") || null;

    const optIn = isDelay
      ? requiresOptIn({ revisedShipDate: revised, currentShipsOn, priorNoticeCount: 0 })
      : false;
    // A delay notice always mails its approved subject, whatever was typed in the tab.
    const sendSubject = resolveSubject(isDelay, optIn, subject);

    // ── Find or create the broadcast for this key ──
    // An existing key is a RESUME: the same message pressed again after an
    // interruption. It sends only to orders with no sent row in
    // broadcast_recipient_sends, so it skips the hourly send limit (it cannot reach
    // anyone twice). A key reused for an edited message is refused.
    const found = await findBroadcast(db, idempotencyKey);
    let bc: BroadcastRow | null = found;
    if (!bc) {
      if (!(await underSendLimit(db, user.id))) {
        return json({ error: "rate_limited", limit: SEND_LIMIT }, 429);
      }
      const { data: inserted, error: bcErr } = await db.from("broadcasts").insert({
        kind,
        subject: sendSubject,
        body_markdown: bodyMarkdown,
        body_html: isDelay ? null : renderBody(bodyMarkdown),
        revised_ship_date: revised,
        requires_opt_in: optIn,
        created_by: user.id,
        idempotency_key: idempotencyKey,
        recipient_log: true,
      }).select(BROADCAST_COLUMNS).single();
      if (bcErr) {
        // 23505: a concurrent press with the same key created it first. Resume that one.
        if ((bcErr as { code?: string }).code !== "23505") throw bcErr;
        bc = await findBroadcast(db, idempotencyKey);
        if (!bc) throw bcErr;
      } else {
        bc = inserted as BroadcastRow;
      }
    }
    const broadcastId = bc.id;

    // Broadcasts created before the per-recipient log existed cannot be resumed
    // safely: there is no record of who got them. Keep the old answer, send nothing.
    if (!bc.recipient_log) {
      console.log(`duplicate broadcast suppressed for key ${idempotencyKey} (pre-log broadcast)`);
      return json({
        broadcast_id: broadcastId,
        sent: bc.sent_count ?? 0,
        failed: bc.failed_count ?? 0,
        total: bc.sent_count ?? 0,
        duplicate: true,
      });
    }

    if (!broadcastMatches(bc, { kind, resolvedSubject: sendSubject, bodyMarkdown, revisedShipDate: revised })) {
      return json({
        error: "This send key belongs to a different message (the subject, text or date changed after the first " +
          "attempt), so nothing was sent. Reload the page to send the edited message as a new one.",
        broadcast_id: broadcastId,
      }, 409);
    }

    const log = await sendLog(db, idempotencyKey);
    const plan = planResume(list, log, new Date());
    if (found) {
      console.log(
        `founder-broadcast: resuming ${broadcastId}: ${plan.toSend.length} to send, ${plan.alreadySent} already sent, ${plan.inFlight} in flight`,
      );
    }

    const deadline = Date.now() + RUN_BUDGET_MS;
    let sentNow = 0;
    let failed = 0;
    let inFlight = plan.inFlight;
    let alreadySent = plan.alreadySent;
    let notReached = 0;
    const failures: Array<{ order_id: string; error: string }> = [];

    for (let i = 0; i < plan.toSend.length; i += SEND_BATCH) {
      if (Date.now() > deadline) {
        notReached = plan.toSend.length - i;
        break;
      }
      for (const r of plan.toSend.slice(i, i + SEND_BATCH)) {
        const claim = await claimRecipient(db, broadcastId, idempotencyKey, r);
        if (claim.kind === "already_sent") { alreadySent += 1; continue; }
        if (claim.kind === "in_flight") { inFlight += 1; continue; }
        if (claim.kind === "error") {
          failed += 1;
          failures.push({ order_id: r.order_id, error: claim.detail });
          continue;
        }
        const claimedAt = claim.claimedAt;
        try {
          let html: string;
          let recipientSubject = sendSubject;
          if (isDelay) {
            // Per-order opt-in determination: an order that has already had a notice
            // always requires affirmative consent, regardless of this slip's size.
            // A failed read must not look like zero prior notices (that could turn an
            // opt-in notice into opt-out), so it throws and this order is not mailed.
            // On a resume the evidence row for THIS broadcast may already exist: it is
            // reused, and not counted as a prior notice.
            const { data: notices, error: noticesErr } = await db
              .from("order_delay_notices")
              .select("broadcast_id, requires_opt_in")
              .eq("order_id", r.order_id);
            if (noticesErr) throw noticesErr;
            const rows = (notices ?? []) as Array<{ broadcast_id: string; requires_opt_in: boolean }>;
            const mine = rows.find((n) => n.broadcast_id === broadcastId);
            const priorCount = rows.filter((n) => n.broadcast_id !== broadcastId).length;
            const orderOptIn = mine
              ? mine.requires_opt_in
              : requiresOptIn({ revisedShipDate: revised, currentShipsOn, priorNoticeCount: priorCount });
            // The subject must follow the per-order opt-in, same as the body.
            recipientSubject = resolveSubject(true, orderOptIn, subject);

            const [consentTok, cancelTok] = await Promise.all([
              signDelayToken({ o: r.order_id, b: broadcastId, r: "consented" }),
              signDelayToken({ o: r.order_id, b: broadcastId, r: "cancelled" }),
            ]);
            html = buildDelayNoticeEmail({
              firstName: firstName(r.shipping_name),
              bodyMarkdown,
              revisedShipDate: revised ? formatDate(revised) : null,
              requiresOptIn: orderOptIn,
              consentUrl: `${SITE}/preorder-response?token=${consentTok}`,
              cancelUrl: `${SITE}/preorder-response?token=${cancelTok}`,
              orderNumber: r.order_number,
            });
            // Evidence row FIRST: a sent notice we failed to record is worse than a
            // recorded notice we failed to send, because only the former is invisible.
            if (!mine) {
              const { error: evErr } = await db.from("order_delay_notices").insert({
                order_id: r.order_id,
                broadcast_id: broadcastId,
                notice_number: priorCount + 1,
                revised_ship_date: revised,
                requires_opt_in: orderOptIn,
              });
              // 23505 on (order_id, broadcast_id): a concurrent attempt wrote it with the
              // same inputs. Anything else stops this order.
              if (evErr && (evErr as { code?: string }).code !== "23505") throw evErr;
            }
          } else {
            html = buildUpdateEmail({
              firstName: firstName(r.shipping_name),
              bodyMarkdown,
              orderNumberLine: r.order_number ? `Order ${r.order_number}` : undefined,
            });
          }
          const messageId = await sendEmail(r.customer_email, recipientSubject, html, `${broadcastId}:${r.order_id}`);
          sentNow += 1;
          await markRecipientSent(db, idempotencyKey, r, claimedAt, messageId);
        } catch (e) {
          failed += 1;
          const message = e instanceof Error ? e.message : String(e);
          failures.push({ order_id: r.order_id, error: message.slice(0, 200) });
          console.error(`broadcast to order ${r.order_id} failed:`, message);
          await captureException(e, { function: "founder-broadcast", order_id: r.order_id });
          // The send demonstrably did not succeed: release the claim so a resume retries it.
          await releaseRecipient(db, idempotencyKey, r, claimedAt);
        }
        await new Promise((res) => setTimeout(res, SEND_SPACING_MS));
      }
      // Progress after every batch, so the broadcast row is never far behind the log.
      await updateProgress(db, broadcastId, idempotencyKey, failed, false);
    }

    const summary = summarizeSend(broadcastId, {
      total: new Set(list.map((r) => r.order_id)).size,
      alreadySent,
      sentNow,
      failed,
      inFlight,
      notReached,
    });
    await updateProgress(db, broadcastId, idempotencyKey, failed, summary.status === 200);
    if (failures.length) summary.body.failures = failures.slice(0, 10);
    return json(summary.body, summary.status);
  } catch (err) {
    console.error("founder-broadcast error:", err);
    await captureException(err, { function: "founder-broadcast" });
    return json({ error: "server_error" }, 500);
  }
});
