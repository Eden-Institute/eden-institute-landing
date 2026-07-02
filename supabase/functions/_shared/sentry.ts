// supabase/functions/_shared/sentry.ts
//
// Dependency-free Sentry error reporter for Deno Edge Functions. Posts a minimal
// event envelope straight to the Sentry ingest API instead of importing the SDK
// (esm.sh SDK builds are heavy and have broken under Deno before). No-ops when
// SENTRY_DSN is unset and never throws: error reporting must never be the thing
// that breaks the webhook.

interface SentryContext {
  function?: string
  [key: string]: unknown
}

export async function captureException(err: unknown, context: SentryContext = {}): Promise<void> {
  try {
    const dsn = Deno.env.get("SENTRY_DSN")
    if (!dsn) return

    // DSN shape: https://<publicKey>@<host>/<projectId>
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/)
    if (!m) {
      console.warn("sentry: unparseable SENTRY_DSN; skipping capture")
      return
    }
    const [, key, host, projectId] = m

    const error = err instanceof Error ? err : new Error(String(err))
    const eventId = crypto.randomUUID().replace(/-/g, "")
    const timestamp = new Date().toISOString()

    const event = {
      event_id: eventId,
      timestamp,
      platform: "javascript",
      level: "error",
      logger: context.function ?? "edge-function",
      environment: "production",
      tags: { function: context.function ?? "unknown" },
      exception: { values: [{ type: error.name, value: error.message }] },
      extra: { ...context, stack: error.stack ?? null },
    }

    const envelope =
      JSON.stringify({ event_id: eventId, sent_at: timestamp }) + "\n" +
      JSON.stringify({ type: "event" }) + "\n" +
      JSON.stringify(event) + "\n"

    const res = await fetch(`https://${host}/api/${projectId}/envelope/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=eden-ef/1.0, sentry_key=${key}`,
      },
      body: envelope,
    })
    if (!res.ok) console.warn(`sentry: ingest returned ${res.status}`)
  } catch (e) {
    console.warn("sentry: capture failed (non-fatal):", e instanceof Error ? e.message : String(e))
  }
}
