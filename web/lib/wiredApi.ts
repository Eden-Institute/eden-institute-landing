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

async function call<T>(fn: string, init: { method: "GET" | "POST"; query?: string; body?: unknown }): Promise<WiredResponse<T>> {
  const headers: Record<string, string> = { apikey: KEY };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const pass = readStore(PREVIEW_KEY);
  if (pass) headers["x-wired-preview"] = pass;
  const res = await fetch(`${BASE}/${fn}${init.query ?? ""}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (res.status === 404 && (data as { error?: string })?.error === "not_found") throw new WiredDark("the quiz is not open yet");
  return { status: res.status, data };
}

export const getBank = (set: string) => call<Record<string, unknown>>("wired-bank", { method: "GET", query: `?set=${encodeURIComponent(set)}` });
export const submitQuiz = (body: unknown) => call<Record<string, unknown>>("wired-submit", { method: "POST", body });
export const getResults = (token: string, childId?: string) =>
  call<Record<string, unknown>>("wired-results", { method: "POST", body: { token, ...(childId ? { child_id: childId } : {}) } });
export const getMatches = (body: unknown) => call<Record<string, unknown>>("wired-matches", { method: "POST", body });

/** W6: the wired cart. create-checkout verifies the token and children, then answers { url } (Stripe). */
export type WiredBuy = "blueprint" | "family_map" | "blueprint_upgrade" | "family_map_upgrade";
export const startWiredCheckout = (body: { token: string; product: WiredBuy; child_ids?: string[] }) =>
  call<{ url?: string; error?: string; code?: string }>("create-checkout", { method: "POST", body: { lookup_key: "wired_cart", ...body } });
