// GA4 page_view for the app's routes, sent once the route's real title is set (2026-10-28).
//
// WHY. GA logged placeholder titles ("Herb Monograph | Eden Apothecary") because the
// Google tag sent page_view on its own the moment the address changed, and each
// route sets document.title later, in a useEffect (useDocumentMeta), and for an herb
// only after the herb has loaded. index.html now configures GA with
// send_page_view: false, and GaPageViewTracker sends page_view itself, here, with
// the title the route actually ends up with. ("Page changes based on browser history
// events" is turned off in GA's Enhanced measurement at the same time, so GA does not
// send its own as well.)
//
// HOW. useDocumentMeta announces every title it sets, with `pending` true while the
// route is still loading what the title is about. The tracker waits for a settled
// title for the current path. A route that never announces one (a page that sets
// document.title by hand, or none at all) is sent after FALLBACK_MS with whatever
// title it has, so every route is still counted once.
//
// The Astro marketing pages are full page loads with their titles in the HTML and
// keep GA's own page_view; none of this runs there.

type Gtag = (...args: unknown[]) => void;

export const DOCUMENT_META_EVENT = "eden:document-meta";
export const FALLBACK_MS = 2500;

interface Announced {
  path: string;
  title: string;
  pending: boolean;
}

let last: Announced | null = null;

/** Called by useDocumentMeta each time it sets a title. Never throws. */
export function announceDocumentMeta(title: string, pending: boolean): void {
  try {
    last = { path: window.location.pathname, title, pending };
    window.dispatchEvent(new CustomEvent<Announced>(DOCUMENT_META_EVENT, { detail: last }));
  } catch {
    // Analytics never break the page.
  }
}

/** The settled title already announced for `path`, if any. */
export function settledTitleFor(path: string): string | null {
  return last && last.path === path && !last.pending ? last.title : null;
}

/** Tests only: forget the last announcement, as a fresh page load would. */
export function resetAnnouncedForTests(): void {
  last = null;
}

/** Send one page_view with an explicit title and address. Never throws. */
export function sendGaPageView(title: string, referrer: string | null): void {
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", "page_view", {
      page_title: title,
      page_location: window.location.href,
      ...(referrer ? { page_referrer: referrer } : {}),
    });
  } catch {
    // Analytics never break the page.
  }
}

/**
 * Wait for `path`'s settled title, then send its page_view once. Returns a cancel
 * function for the route-change cleanup (a reader who moves on before the title
 * settles is counted on the next route, not this one).
 */
export function sendPageViewWhenTitled(path: string, referrer: string | null, fallbackMs = FALLBACK_MS): () => void {
  let done = false;
  const send = (title: string) => {
    if (done) return;
    done = true;
    cleanup();
    sendGaPageView(title, referrer);
  };
  const onMeta = (e: Event) => {
    const d = (e as CustomEvent<Announced>).detail;
    if (d && d.path === path && !d.pending) send(d.title);
  };
  const timer = window.setTimeout(() => send(document.title), fallbackMs);
  function cleanup() {
    window.clearTimeout(timer);
    window.removeEventListener(DOCUMENT_META_EVENT, onMeta);
  }
  window.addEventListener(DOCUMENT_META_EVENT, onMeta);
  const already = settledTitleFor(path);
  if (already !== null) send(already);
  return () => {
    done = true;
    cleanup();
  };
}
