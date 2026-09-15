// Deep-Dive Guide access on /guide/:slug (founder decision 2026-09-15).
//
// Two ways back to a paid guide besides the post-checkout ?session_id:
//
// 1. EMAILED ACCESS LINK. guide-access-link emails /guide/<slug>?access=<token>
//    (7-day HMAC token). That token is a bearer credential, so like the Stripe
//    session id it must leave the address bar BEFORE Google Tag Manager, gtag or
//    Pinterest read location.href. GUIDE_ACCESS_STRIP_JS runs as the second head
//    script of index.html (right after the session id strip, before any tag). On a
//    /guide/ path it moves `access` into window.__edenGuideAccess and
//    sessionStorage (same tab, same path, so a reload still opens the guide) and
//    removes only that param with history.replaceState. index.html cannot import
//    this module, so it carries a VERBATIM copy; src/test/guideAccess.test.ts fails
//    if they drift. readGuideAccessToken() reads it back.
//
// 2. REMEMBERED CHECKOUT SESSION. The page used to keep the Stripe session id in
//    localStorage forever. It now keeps { sessionId, savedAt } for 90 days, and a
//    bare legacy string is upgraded in place (counted from the day it is first read)
//    so nobody who bought before this change is locked out today.

export const GUIDE_ACCESS_PARAM = "access";
export const GUIDE_ACCESS_STORAGE_KEY = "eden_guide_access";
export const GUIDE_SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const guideSessionKey = (slug: string) => `guide_session_${slug}`;

/** Inline head script. Plain ES5, no dependencies. Keep the key names in step. */
export const GUIDE_ACCESS_STRIP_JS = `(function () {
  try {
    var path = window.location.pathname;
    if (path.indexOf('/guide/') !== 0) return;
    var search = window.location.search;
    if (!search || search.length < 2) return;
    var parts = search.slice(1).split('&');
    var kept = [];
    var token = '';
    var found = false;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === '') continue;
      var eq = part.indexOf('=');
      var rawKey = eq === -1 ? part : part.slice(0, eq);
      var key = rawKey;
      try { key = decodeURIComponent(rawKey.replace(/\\+/g, ' ')); } catch (e) {}
      if (key !== 'access') { kept.push(part); continue; }
      found = true;
      if (!token && eq !== -1) {
        var rawVal = part.slice(eq + 1);
        try { token = decodeURIComponent(rawVal.replace(/\\+/g, ' ')); } catch (e) { token = rawVal; }
      }
    }
    if (!found) return;
    if (token) {
      var entry = { token: token, path: path };
      window.__edenGuideAccess = entry;
      try { window.sessionStorage.setItem('eden_guide_access', JSON.stringify(entry)); } catch (e) {}
    }
    window.history.replaceState(window.history.state, '', path + (kept.length ? '?' + kept.join('&') : '') + window.location.hash);
  } catch (e) {}
})();`;

interface StoredAccess {
  token: string;
  path: string;
}

function isStoredAccess(v: unknown): v is StoredAccess {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as StoredAccess).token === "string" &&
    (v as StoredAccess).token !== "" &&
    typeof (v as StoredAccess).path === "string"
  );
}

const samePath = (a: string, b: string) => {
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  return norm(a) === norm(b);
};

/** The emailed access token for this page: URL, then window global, then sessionStorage (same path). */
export function readGuideAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(GUIDE_ACCESS_PARAM);
    if (fromUrl) return fromUrl;
  } catch {
    // fall through
  }
  const path = window.location.pathname;
  const w = window as unknown as { __edenGuideAccess?: unknown };
  if (isStoredAccess(w.__edenGuideAccess) && samePath(w.__edenGuideAccess.path, path)) {
    return w.__edenGuideAccess.token;
  }
  try {
    const raw = window.sessionStorage.getItem(GUIDE_ACCESS_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredAccess(parsed) && samePath(parsed.path, path)) return parsed.token;
    }
  } catch {
    // storage blocked
  }
  return null;
}

/** Forget a token that failed verification, and take it out of the URL if it is still there. */
export function clearGuideAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    delete (window as unknown as { __edenGuideAccess?: unknown }).__edenGuideAccess;
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(GUIDE_ACCESS_STORAGE_KEY);
  } catch {
    // ignore
  }
  stripGuideAccessFromUrl();
}

/** Remove only `access` from the address bar (the head script normally already has). */
export function stripGuideAccessFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(GUIDE_ACCESS_PARAM)) return;
    url.searchParams.delete(GUIDE_ACCESS_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    // ignore
  }
}

/** The remembered checkout session id for a guide, or null when absent or older than 90 days. */
export function readStoredGuideSession(slug: string, now: number = Date.now()): string | null {
  try {
    const key = guideSessionKey(slug);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (
      parsed && typeof parsed === "object" &&
      typeof (parsed as { sessionId?: unknown }).sessionId === "string" &&
      typeof (parsed as { savedAt?: unknown }).savedAt === "number"
    ) {
      const { sessionId, savedAt } = parsed as { sessionId: string; savedAt: number };
      if (sessionId && now - savedAt < GUIDE_SESSION_TTL_MS) return sessionId;
      localStorage.removeItem(key);
      return null;
    }
    // Legacy: the bare session id stored before 2026-09-15. Upgrade it so it expires.
    if (typeof raw === "string" && raw.startsWith("cs_")) {
      localStorage.setItem(key, JSON.stringify({ sessionId: raw, savedAt: now }));
      return raw;
    }
    localStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

export function saveGuideSession(slug: string, sessionId: string, now: number = Date.now()): void {
  try {
    localStorage.setItem(guideSessionKey(slug), JSON.stringify({ sessionId, savedAt: now }));
  } catch {
    // storage blocked: the emailed link still works
  }
}

export function forgetGuideSession(slug: string): void {
  try {
    localStorage.removeItem(guideSessionKey(slug));
  } catch {
    // ignore
  }
}
