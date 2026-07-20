// Founder dashboard: reach the preorder cohort.
//
// Two jobs, deliberately in one place because they use the same recipient list:
//   Update      — the manufacturer progress notes promised in the /preorder buy box
//                 ("you will hear from us the whole way through").
//   Delay notice — the FTC-required notice under 16 CFR 435.2(b), with per-order
//                 consent tracking and one-click cancel links.
//
// Design rule: PREVIEW BEFORE SEND IS MANDATORY. This goes to every buyer at once and
// there is no unsend, so the Send button stays disabled until a preview of the real
// rendered email against the real recipient count has been generated.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Kind = "update" | "delay_notice";

interface PreviewResult {
  recipient_count: number;
  subject: string;
  html: string;
}

interface PendingRow {
  order_id: string;
  customer_email: string;
  amount_total_cents: number | null;
  notice_sent_at: string;
  days_since_notice: number;
}

function money(cents: number | null): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

async function callBroadcast<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("founder-broadcast", { body });
  if (error) {
    let message: string | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      const payload = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      message = payload?.error ?? null;
    } catch {
      // non-JSON body; fall through
    }
    throw new Error(message ?? error.message ?? "Request failed");
  }
  return data as T;
}

export default function BroadcastTab() {
  const [kind, setKind] = useState<Kind>("update");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [revisedDate, setRevisedDate] = useState("");
  const [currentShipsOn, setCurrentShipsOn] = useState("2026-12-31");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // null means "not known", not "empty". See loadPending.
  const [pending, setPending] = useState<PendingRow[] | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  // One key per composed message, so a double-click, a retried fetch, or a browser
  // back-navigation cannot mail the cohort twice. Rotated only after a send succeeds,
  // which is what makes the retry path safe: the same message keeps the same key.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  // Any edit invalidates the preview, so Send can never fire text that was not
  // previewed. This is the whole safety property of the screen.
  const invalidate = useCallback(() => {
    setPreview(null);
    setResult(null);
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const r = await callBroadcast<{ pending: PendingRow[] }>({ mode: "pending" });
      if (live.current) {
        setPending(r.pending ?? []);
        setPendingError(null);
      }
    } catch (e) {
      // A failure here must not block composing -- that part was right. But it must not
      // read as "all clear" either. This queue is the 435.2(b)(1)(iii) auto-refund list;
      // rendering nothing on a failed check is indistinguishable from a genuinely empty
      // queue, and misreading it is an FTC violation rather than a bad chart. Leave
      // `pending` null (unknown) instead of [] (verified empty) and say so.
      if (live.current) {
        setPending(null);
        setPendingError(e instanceof Error ? e.message : "Could not load the refund queue");
      }
    }
  }, []);

  useEffect(() => { void loadPending(); }, [loadPending]);

  const isDelay = kind === "delay_notice";
  // An indefinite delay is legitimate but always requires opt-in, so it is allowed
  // here rather than blocked; the server decides the consent rule, not this form.
  const canPreview = subject.trim().length > 0 && body.trim().length > 0;

  async function doPreview() {
    setBusy("preview");
    setError(null);
    try {
      const r = await callBroadcast<PreviewResult>({
        mode: "preview",
        kind,
        subject,
        body_markdown: body,
        revised_ship_date: isDelay && revisedDate ? revisedDate : null,
        current_ships_on: currentShipsOn || null,
      });
      if (live.current) setPreview(r);
    } catch (e) {
      if (live.current) setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      if (live.current) setBusy(null);
    }
  }

  async function doSend() {
    if (!preview) return;
    const what = isDelay ? "DELAY NOTICE" : "update";
    if (!window.confirm(
      `Send this ${what} to ${preview.recipient_count} preorder customers?\n\n`
      + `Subject: ${preview.subject}\n\nThis cannot be undone.`,
    )) return;

    setBusy("send");
    setError(null);
    try {
      const r = await callBroadcast<{
        sent: number; failed: number; total: number; duplicate?: boolean;
      }>({
        mode: isDelay ? "delay" : "send",
        subject,
        body_markdown: body,
        revised_ship_date: isDelay && revisedDate ? revisedDate : null,
        current_ships_on: currentShipsOn || null,
        idempotency_key: idempotencyKey,
      });
      if (!live.current) return;
      setResult(
        r.duplicate
          ? `Already sent. This exact message reached ${r.sent} customers, and was not sent again.`
          : `Sent to ${r.sent} of ${r.total}.${r.failed ? ` ${r.failed} failed.` : ""}`,
      );
      setPreview(null);
      setSubject("");
      setBody("");
      // New message, new key. Only after a confirmed send, so a failed attempt can be
      // retried under the SAME key and stay protected.
      setIdempotencyKey(crypto.randomUUID());
      void loadPending();
    } catch (e) {
      if (live.current) setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      if (live.current) setBusy(null);
    }
  }

  const field = "w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm";

  return (
    <div className="space-y-8">
      {/* Orders needing a refund because an opt-in notice went unanswered. Under
          435.2(b)(1)(iii) these are deemed cancelled and must be refunded WITHOUT the
          customer asking, so this sits above the composer rather than below it. */}
      {/* Unknown is not the same as clear. If the check itself failed, say so rather
          than rendering the same nothing an empty queue renders. */}
      {pendingError && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: "hsl(var(--eden-gold) / 0.5)", backgroundColor: "hsl(var(--eden-gold) / 0.07)" }}
        >
          <p className="font-body text-sm">
            <strong>Couldn't check the refund queue.</strong> This is the list of orders
            that are cancelled by law and owed a refund. Not knowing is not the same as
            none, so check it before sending anything.{" "}
            <button
              type="button"
              onClick={() => void loadPending()}
              className="underline underline-offset-4"
            >
              Try again
            </button>
          </p>
        </div>
      )}

      {pending && pending.length > 0 && (
        <div
          className="rounded-lg border-2 p-4"
          style={{ borderColor: "hsl(var(--destructive) / 0.5)", backgroundColor: "hsl(var(--destructive) / 0.05)" }}
        >
          <p className="font-serif font-bold mb-1" style={{ color: "hsl(var(--destructive))" }}>
            {pending.length} order{pending.length === 1 ? "" : "s"} must be refunded
          </p>
          <p className="font-body text-sm text-muted-foreground mb-3">
            These buyers were sent a delay notice that required their agreement, and 30 days
            have passed with no answer. They are cancelled by law and you must refund them
            in Stripe without waiting to be asked.
          </p>
          <ul className="font-body text-sm space-y-1">
            {pending.map((p) => (
              <li key={p.order_id}>
                {p.customer_email} · {money(p.amount_total_cents)} · {p.days_since_notice} days since notice
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
          Write to your preorder customers
        </h2>
        <p className="font-body text-sm text-muted-foreground">
          Goes to every buyer whose order is not cancelled or refunded, including those
          already shipped.
        </p>
      </div>

      <div className="flex gap-2">
        {(["update", "delay_notice"] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setKind(k); invalidate(); }}
            className={`rounded-md border px-4 py-2 font-body text-sm ${kind === k ? "border-[hsl(var(--eden-gold))] bg-[hsl(var(--eden-gold))]/10" : "border-border"}`}
          >
            {k === "update" ? "Progress update" : "Delay notice (legal)"}
          </button>
        ))}
      </div>

      {isDelay && (
        <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: "hsl(var(--eden-gold) / 0.4)" }}>
          <p className="font-body text-sm text-muted-foreground">
            A delay notice is a legal document, not an email. It must offer a full refund and
            a free way to take it. Whether silence counts as agreement or as cancellation is
            decided by the dates below, and the wording changes to match. Leave the new date
            blank if you genuinely cannot commit to one yet.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="font-body text-sm">
              Date currently promised
              <input type="date" value={currentShipsOn} className={field}
                onChange={(e) => { setCurrentShipsOn(e.target.value); invalidate(); }} />
            </label>
            <label className="font-body text-sm">
              New ship date (blank if unknown)
              <input type="date" value={revisedDate} className={field}
                onChange={(e) => { setRevisedDate(e.target.value); invalidate(); }} />
            </label>
          </div>
        </div>
      )}

      <label className="block font-body text-sm">
        Subject
        <input type="text" value={subject} className={field} maxLength={200}
          placeholder={isDelay ? "An update on your Eden's Table ship date" : "Your kit: the print proofs are in"}
          onChange={(e) => { setSubject(e.target.value); invalidate(); }} />
      </label>

      <label className="block font-body text-sm">
        Message
        <textarea rows={12} value={body} className={`${field} font-mono`}
          placeholder={"Blank line between paragraphs.\n\n## A heading looks like this\n\n[A link looks like this](https://edeninstitute.health/preorder)"}
          onChange={(e) => { setBody(e.target.value); invalidate(); }} />
        <span className="text-xs text-muted-foreground">
          Paragraphs, ## headings, and [links](https://...). Everything else is shown as
          plain text, on purpose.
        </span>
      </label>

      {error && <p className="font-body text-sm text-destructive">{error}</p>}
      {result && <p className="font-body text-sm" style={{ color: "hsl(var(--eden-forest))" }}>{result}</p>}

      <div className="flex gap-3 items-center">
        <button type="button" onClick={doPreview} disabled={!canPreview || busy !== null}
          className="rounded-md border border-border px-5 py-2 font-body text-sm disabled:opacity-50">
          {busy === "preview" ? "Rendering…" : "Preview"}
        </button>
        <button type="button" onClick={doSend} disabled={!preview || busy !== null}
          className="rounded-md px-5 py-2 font-body text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}>
          {busy === "send"
            ? "Sending…"
            : preview
              ? `Send to ${preview.recipient_count}`
              : "Preview first"}
        </button>
        {!preview && canPreview && (
          <span className="font-body text-xs text-muted-foreground">
            Sending is locked until you have previewed this exact text.
          </span>
        )}
      </div>

      {preview && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="px-4 py-2 border-b bg-muted/40" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="font-body text-xs text-muted-foreground">
              Preview · {preview.recipient_count} recipient{preview.recipient_count === 1 ? "" : "s"}
            </p>
            <p className="font-body text-sm font-semibold">{preview.subject}</p>
          </div>
          {/* Sandboxed: the preview renders our own generated HTML, but an iframe keeps
              it from touching the dashboard's styles or scripts either way. */}
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.html}
            className="w-full"
            style={{ height: 620, border: "none", backgroundColor: "#F5F0E8" }}
          />
        </div>
      )}
    </div>
  );
}
