// Canva Connect round-trip, client half (Ad Studio Phase 3).
//
// The browser never sees the client secret. It generates the PKCE pair, sends
// the user to Canva, and hands the returned code plus verifier to the
// canva-connect edge function, which does the secret-bearing token exchange.
// Canva blocks that exchange from browser origins by CORS, so this split is
// required rather than merely tidy.
//
// STATUS (2026-07 audit): the one-question flow that replaced the five-screen
// wizard offers Canva only as a manual handoff link, so beginConnect/export/
// reimport currently have no UI entry point. Kept intact, with the EF, pending
// a founder decision to either re-wire "Send to Canva" into the export screen
// or retire the round-trip. completeConnect stays mounted on /studio so an
// in-flight OAuth return can never strand her on an error page.

import { invokeStudioFunction } from "./studio-invoke";

const VERIFIER_KEY = "eden.canva.pkce_verifier";
const STATE_KEY = "eden.canva.oauth_state";
const PROJECT_KEY = "eden.canva.project_id";

export interface CanvaStatus {
  connected: boolean;
  expiresAt: string | null;
}

const invoke = <T,>(body: Record<string, unknown>) =>
  invokeStudioFunction<T>("canva-connect", body);

// ── PKCE ────────────────────────────────────────────────────────────────────

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(bytes = 48): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return base64url(a.buffer);
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(digest);
}

/** The redirect must match one registered in the developer portal exactly.
 *  Both https://edeninstitute.health/studio and http://127.0.0.1:8080/studio
 *  are registered; localhost is normalised to 127.0.0.1 to match. */
export function redirectUri(): string {
  const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : "";
  return `${window.location.protocol}//${host}${port}/studio`;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function status(): Promise<CanvaStatus> {
  return invoke<CanvaStatus>({ mode: "status" });
}

export function disconnect(): Promise<CanvaStatus> {
  return invoke<CanvaStatus>({ mode: "disconnect" });
}

/** Send the founder to Canva to authorize. Returns nothing: it navigates. */
export async function beginConnect(projectId: string): Promise<void> {
  const verifier = randomString();
  const state = randomString(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  // So the callback can return to the project the founder started from.
  sessionStorage.setItem(PROJECT_KEY, projectId);

  const { url } = await invoke<{ url: string }>({
    mode: "auth_url",
    codeChallenge: await challengeFor(verifier),
    state,
    redirectUri: redirectUri(),
  });
  window.location.assign(url);
}

export interface CallbackResult {
  connected: boolean;
  projectId: string | null;
}

/** Handle ?code=&state= on /studio. Returns null when this is a normal load.
 *  Throws on a state mismatch, which is the CSRF check. */
export async function completeConnect(): Promise<CallbackResult | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return null;

  const expected = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const projectId = sessionStorage.getItem(PROJECT_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(PROJECT_KEY);

  // Clear the code out of the address bar either way: it is single-use and has
  // no business surviving in history.
  window.history.replaceState({}, "", window.location.pathname);

  if (!expected || state !== expected) throw new Error("Canva returned an unexpected state. Not completing the connection.");
  if (!verifier) throw new Error("Missing PKCE verifier. Start the Canva connection again.");

  await invoke({ mode: "exchange", code, codeVerifier: verifier, redirectUri: redirectUri() });
  return { connected: true, projectId };
}

export interface ExportResult {
  designId: string;
  editUrl: string | null;
}

/** Push a rendered creative to Canva as a new design. */
export function exportToCanva(input: {
  projectId: string;
  pngBase64: string;
  title: string;
  width: number;
  height: number;
  assetId?: string | null;
}): Promise<ExportResult> {
  return invoke<ExportResult>({ mode: "export", ...input });
}

export interface ReimportResult {
  assetId: string;
  storagePath: string;
  url: string | null;
}

/** Pull the finished design back, overwriting the active version. */
export function reimportFromCanva(projectId: string): Promise<ReimportResult> {
  return invoke<ReimportResult>({ mode: "reimport", projectId });
}
