/**
 * Browser error report (2026-11-17, Lane 2 deep audit area 16 finding E1; Camila's tap
 * "Yes, build it").
 *
 * WHY. Every failure that reached the server showed up in Supabase; nothing that broke in
 * the visitor's browser did. A buy button or form that failed before its request left
 * (a script error, a promise nothing caught, a function call that never connected) left no
 * trace anywhere. This reports those three things to record_client_error
 * (supabase/migrations/20261117225940_client_error_reports.sql), and the morning digest's
 * System health block shows a line when there were any.
 *
 * WHAT IS REPORTED, and only this:
 *   - "error": an uncaught script error from this site's own files (same origin). Browser
 *     extensions, other sites' scripts (Google, Meta, Pinterest), "Script error." with no
 *     detail and the harmless ResizeObserver warning are ignored.
 *   - "rejection": a promise nothing caught, when its stack points at this site's files.
 *   - "function": a call to one of our Supabase edge functions (checkout, forms, downloads)
 *     that answered 500 or more, or never connected while the page was open. Expected
 *     refusals (400, 409, 422, 429: a misspelled email, the rate limit) are NOT errors.
 *
 * PRIVACY. Same posture as the page-view beacon: no cookies, nothing stored in the browser,
 * no consent gate. Sent: the error text, the script path, the page path WITHOUT its query
 * string, and for a function call its name and status. The database function blanks email
 * addresses, long tokens and long numbers again and stores no IP address.
 *
 * SAFETY. Reporting never breaks the page: every step is wrapped, at most 5 reports leave a
 * page, the same error is sent once per page, and the report itself goes out through the
 * browser's own fetch (saved before the wrapper), so it can never report on itself.
 */

export type ClientErrorKind = "error" | "rejection" | "function";

export interface ClientErrorReport {
  kind: ClientErrorKind;
  message: string;
  source?: string | null;
  line?: number | null;
  col?: number | null;
  fn?: string | null;
  status?: number | null;
}

interface BeaconOptions {
  supabaseUrl: string;
  key: string;
}

const MAX_PER_PAGE = 5;
const IGNORED_MESSAGES = [/^script error\.?$/i, /resizeobserver loop/i];

/** The edge function a URL calls, when it is one of OUR functions; otherwise null. */
export function functionNameFromUrl(url: string, supabaseUrl: string): string | null {
  if (!supabaseUrl) return null;
  const base = supabaseUrl.replace(/\/$/, "");
  if (!url.startsWith(`${base}/functions/v1/`)) return null;
  const m = /\/functions\/v1\/([a-z0-9-]{1,60})(?:[/?#]|$)/.exec(url);
  return m ? m[1] : null;
}

/** Path only: no host, no query string, no fragment. */
export function stripToPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const noHost = url.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/]*/, "");
  const path = noHost.split("?")[0].split("#")[0];
  return path || null;
}

/** An uncaught script error worth reporting: from this site's own files, with real detail. */
export function shouldReportError(message: string, filename: string | null | undefined, origin: string): boolean {
  if (!message || IGNORED_MESSAGES.some((re) => re.test(message.trim()))) return false;
  if (!filename) return false;
  return filename.startsWith(`${origin}/`);
}

/** A promise nothing caught, worth reporting when its stack points at this site's files. */
export function rejectionReport(reason: unknown, origin: string): ClientErrorReport | null {
  if (!(reason instanceof Error)) return null;
  if (reason.name === "AbortError") return null;
  const stack = typeof reason.stack === "string" ? reason.stack : "";
  if (!stack.includes(`${origin}/`)) return null;
  const message = `${reason.name}: ${reason.message}`.slice(0, 300);
  if (IGNORED_MESSAGES.some((re) => re.test(reason.message))) return null;
  const frame = stack.split("\n").find((l) => l.includes(`${origin}/`)) ?? "";
  const loc = /(https?:\/\/[^\s)]+?):(\d+):(\d+)/.exec(frame);
  return {
    kind: "rejection",
    message,
    source: loc ? loc[1] : null,
    line: loc ? Number(loc[2]) : null,
    col: loc ? Number(loc[3]) : null,
  };
}

/** The answer from one of our functions that counts as an error: 500 or more. */
export function isFunctionFailure(status: number): boolean {
  return status >= 500;
}

let installed = false;

/**
 * Install once per page (both callers are idempotent through this flag). Safe to call during
 * server-side rendering: it does nothing without a window.
 */
export function installClientErrorBeacon({ supabaseUrl, key }: BeaconOptions): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (!supabaseUrl || !key) return;
  installed = true;

  const origin = window.location.origin;
  const nativeFetch = window.fetch.bind(window);
  const sentKeys = new Set<string>();
  let sent = 0;
  let leaving = false;

  const send = (r: ClientErrorReport): void => {
    try {
      const dedupe = `${r.kind}|${r.fn ?? ""}|${r.message}`;
      if (sent >= MAX_PER_PAGE || sentKeys.has(dedupe)) return;
      sentKeys.add(dedupe);
      sent += 1;
      void nativeFetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/record_client_error`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({
          p_kind: r.kind,
          p_message: r.message.slice(0, 300),
          p_source: stripToPath(r.source ?? null),
          p_line: r.line ?? null,
          p_col: r.col ?? null,
          p_path: window.location.pathname,
          p_fn: r.fn ?? null,
          p_status: r.status ?? null,
        }),
        keepalive: true,
        credentials: "omit",
      }).catch(() => {});
    } catch {
      // Reporting never breaks the page.
    }
  };

  window.addEventListener("pagehide", () => {
    leaving = true;
  });

  window.addEventListener("error", (e: ErrorEvent) => {
    try {
      if (!shouldReportError(e.message, e.filename, origin)) return;
      send({ kind: "error", message: e.message, source: e.filename, line: e.lineno, col: e.colno });
    } catch {
      // ignore
    }
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    try {
      const r = rejectionReport(e.reason, origin);
      if (r) send(r);
    } catch {
      // ignore
    }
  });

  // Edge-function calls. supabase-js looks up the global fetch on every call
  // (@supabase/supabase-js 2.97 resolveFetch), so this wrapper sees functions.invoke() too.
  const wrapped: typeof window.fetch = async (input, init) => {
    let fn: string | null = null;
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      fn = functionNameFromUrl(url, supabaseUrl);
    } catch {
      fn = null;
    }
    if (!fn) return nativeFetch(input, init);
    try {
      const res = await nativeFetch(input, init);
      if (isFunctionFailure(res.status)) {
        send({ kind: "function", fn, status: res.status, message: `${fn} answered ${res.status}` });
      }
      return res;
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (!aborted && !leaving && document.visibilityState === "visible") {
        send({ kind: "function", fn, status: 0, message: `${fn} could not be reached` });
      }
      throw err;
    }
  };
  window.fetch = wrapped;
}

/** Test hook: lets a test install twice in one module instance. */
export function __resetClientErrorBeaconForTests(): void {
  installed = false;
}
