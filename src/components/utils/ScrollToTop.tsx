import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scroll the window to top on every route navigation.
 *
 * React Router v6 deliberately doesn't restore scroll on navigation —
 * the rationale is that there isn't a single right answer for every
 * app, so the team punts the choice to the consumer. For our marketing
 * surface the right answer is always: a fresh route mounts at the top.
 *
 * Mount once inside <BrowserRouter> so it has access to useLocation.
 * Returns null — it's a side-effect component.
 *
 * Hash navigation (e.g. /tier-2-waitlist#waitlist-form) is preserved:
 * we scroll to the named element instead of jumping to the page top,
 * which is what the user expects when they click an anchor link.
 *
 * Why this exists: Camila reported (2026-04-30) that clicking the
 * Tier 2 card on / lands the visitor at the BOTTOM of /courses because
 * that's where their scroll position was when they left the previous
 * page. Same bug surfaces on every route transition site-wide.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Hash navigation: scroll to the named element. The browser does
      // this natively for full-page loads but NOT for SPA pushes —
      // re-implement it here so /tier-2-waitlist#waitlist-form works
      // both as an external link and as an internal Link.
      const id = hash.startsWith("#") ? hash.slice(1) : hash;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView();
        return;
      }
      // Element not yet mounted (rare race) — fall through to top.
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
