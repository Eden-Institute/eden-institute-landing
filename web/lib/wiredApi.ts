// Fearfully & Wonderfully Wired (W4): how the /wired islands reach the wired-* edge functions.
// Plain fetch with the publishable key (like EsaInvoiceForm), no Supabase client.
//
// DARK until launch: the functions answer 404 unless WIRED_ENABLED is on. For a preview, the
// browser may hold the private pass in localStorage ("eden_wired_preview"); it is sent as the
// x-wired-preview header and nowhere else. Storage access is wrapped: a private window works the
// same, it just never has a pass.
//
// The results token: kept in localStorage ("eden_wired_results") on HER device so she can come back
// to her results; it never goes in a URL we build, and the results page strips any ?t= it arrives with.

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
export const PREVIEW_KEY = "eden_wired_preview";
// 2026-11-22 testers-only pilot: a selected tester's pass from her "You're in" button (/wired#pilot=, saved by the
// head script src/lib/wiredPreviewLink.ts). Sent as x-wired-pass, which opens the dark quiz for a SELECTED tester only
// while the pilot switch is on (supabase/functions/_shared/wired-pilot-pass.ts). Without it, the call's own link
// (her results token, a retake link, a rater code) or her saved results token is sent, so later emails work on any
// device. Never sent with the preview pass (that already opens everything) and never to create-checkout.
export const PILOT_KEY = "eden_wired_pilot";
export const RESULTS_KEY = "eden_wired_results";

function readStore(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}
export function writeStore(k: string, v: string | null): void {
  try {
    if (v === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* private window: nothing kept */
  }
}
export const savedResultsToken = () => readStore(RESULTS_KEY);

export class WiredDark extends Error {}

export interface WiredResponse<T> { status: number; data: T }

type CallInit = { method: "GET" | "POST"; query?: string; body?: unknown; cred?: unknown; noPass?: boolean };

/** The x-wired-pass value for a call: her pilot pass, else the call's own link, else her saved results token. */
export function testerPass(cred?: unknown): string | null {
  const own = typeof cred === "string" && cred ? cred : null;
  return readStore(PILOT_KEY) || own || readStore(RESULTS_KEY);
}

async function call<T>(fn: string, init: CallInit): Promise<WiredResponse<T>> {
  const headers: Record<string, string> = { apikey: KEY };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const pass = readStore(PREVIEW_KEY);
  if (pass) headers["x-wired-preview"] = pass;
  else if (!init.noPass) {
    const tp = testerPass(init.cred);
    if (tp) headers["x-wired-pass"] = tp;
  }
  const res = await fetch(`${BASE}/${fn}${init.query ?? ""}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (res.status === 404 && (data as { error?: string })?.error === "not_found") throw new WiredDark("the quiz is not open yet");
  return { status: res.status, data };
}

export const getBank = (set: string, cred?: string) => call<Record<string, unknown>>("wired-bank", { method: "GET", query: `?set=${encodeURIComponent(set)}`, cred });
export const submitQuiz = (body: unknown) => call<Record<string, unknown>>("wired-submit", { method: "POST", body, cred: (body as { token?: unknown })?.token });
export const getResults = (token: string, childId?: string) =>
  call<Record<string, unknown>>("wired-results", { method: "POST", body: { token, ...(childId ? { child_id: childId } : {}) }, cred: token });
export const getMatches = (body: unknown) => call<Record<string, unknown>>("wired-matches", { method: "POST", body, cred: (body as { token?: unknown })?.token });
/** The July yearly-retest link (/wired/retake?r=): the child's nickname, the assumed grade and her email. */
export interface RetakeInfo { status: string; child_id?: string; nickname?: string; grade?: number; email?: string }
export const getRetake = (r: string) => call<RetakeInfo>("wired-retake", { method: "POST", body: { r }, cred: r });

/** W6: the wired cart. create-checkout verifies the token and children, then answers { url } (Stripe). */
export type WiredBuy = "blueprint" | "family_map" | "blueprint_upgrade" | "family_map_upgrade";
export const startWiredCheckout = (body: { token: string; product: WiredBuy; child_ids?: string[]; reminder_consent?: boolean }) =>
  call<{ url?: string; error?: string; code?: string }>("create-checkout", { method: "POST", body: { lookup_key: "wired_cart", ...body }, noPass: true });

/** W9: the teen link (grade 9+, age picked from 10-18; 13+ gets { url }, under 13 gets { under_13: true }). */
export const getTeenLink = (body: { token: string; child_id: string; age: number }) =>
  call<{ url?: string; under_13?: boolean; error?: string }>("wired-teen-link", { method: "POST", body, cred: body.token });
/** W9: people she invites for a Blueprint child (list / add / remove). */
export interface ObserverRow { id: string; label: string | null; email: string; status: "invited" | "answered" | "expired" }
export const observers = (body: { token: string; child_id: string; action: "list" | "add" | "remove"; email?: string; label?: string; observer_id?: string }) =>
  call<{ observers?: ObserverRow[]; max?: number; error?: string }>("wired-observers", { method: "POST", body, cred: body.token });
/** W9: the teen / observer side of the quiz (their private link code, never a family token). */
export const rater = (body: { kind: "teen" | "observer"; code: string; action: "context" | "submit"; bank_version?: string; answers?: unknown }) =>
  call<{ nickname?: string; mom?: string; set_kind?: string; label?: string | null; status?: string; error?: string }>("wired-rater", { method: "POST", body, cred: raterPass(body.kind, body.code) });
/** A rater page's pass (its own private link, which wired-pilot-pass.ts traces to the family). */
export const raterPass = (kind: "teen" | "observer", code: string) => `rater:${kind}:${code}`;
/** W9: "Delete my quiz data". request = email the confirm link; confirm = delete. */
export const deleteData = (body: { action: "request" | "confirm"; token?: string; email?: string }) =>
  call<{ ok?: boolean; deleted?: boolean; error?: string }>("wired-delete", { method: "POST", body, cred: body.token });

/** W12: the pilot (dark behind WIRED_PILOT_OPEN). apply = the application; status/survey/retake use her results token. */
export const pilot = (body: Record<string, unknown>) =>
  call<Record<string, unknown>>("wired-pilot", { method: "POST", body, cred: body.token });

/**
 * True when the quiz is dark for this visitor (no preview pass): one light request (the K-2 questions, which
 * wired-bank caches for 5 minutes), the same check /wired makes. A network error is NOT "dark" (false).
 */
export async function wiredIsDark(): Promise<boolean> {
  try {
    await getBank("k2");
    return false;
  } catch (err) {
    return err instanceof WiredDark;
  }
}
