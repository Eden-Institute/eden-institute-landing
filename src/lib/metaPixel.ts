// Meta Pixel (consent-gated). The Pixel script is injected ONLY after the user
// grants marketing consent via the cookie banner — never on initial load. This
// keeps us aligned with the Cookie Policy's "marketing cookies only with
// explicit consent" promise.
//
// Pixel ID 1535058498232762 (Eden Institute, Meta Events Manager).

const PIXEL_ID = "1535058498232762";
let injected = false;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/** Inject + init the Pixel. Idempotent. Does NOT fire PageView — callers do. */
export function loadMetaPixel(): void {
  if (injected || typeof window === "undefined") return;
  injected = true;
  /* Meta's standard loader snippet. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (function (f: any, b: any, e: string, v: string, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      // eslint-disable-next-line prefer-rest-params
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq?.("init", PIXEL_ID);
}

/** Fire a PageView (no-op until the Pixel has been loaded with consent). */
export function metaPageView(): void {
  if (injected) window.fbq?.("track", "PageView");
}

/** Fire a standard/custom event (no-op until loaded). e.g. metaTrack("Lead"). */
export function metaTrack(event: string, params?: Record<string, unknown>): void {
  if (injected) window.fbq?.("track", event, params);
}
