// Marketing-page analytics + consent, mounted once per page as a client island.
// Replaces what App.tsx mounts globally in the SPA (PageViewTracker,
// MetaPixelTracker, ConsentBanner) for routes Astro now owns. On Astro pages
// every navigation is a full page load, so a single mount-time fire is the
// correct equivalent of the SPA's per-route effects — no router needed.
//
// All window/localStorage/Supabase access happens inside useEffect or event
// handlers (never during render) so server-side rendering of this island stays
// safe. Reuses the exact consent + Pixel libraries the SPA uses.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMarketingConsent } from "@/lib/consent";
import { loadMetaPixel, metaPageView } from "@/lib/metaPixel";
import { ConsentBannerView } from "@/components/ConsentBanner";
import { captureFirstTouch } from "@/lib/attribution";

const SKIP_PREFIXES = ["/founder", "/apothecary/auth", "/apothecary/account"];

/**
 * CRO Phase 4: cookieless CTA click beacon for Astro pages. Every internal
 * CTA click here triggers a full page unload, which can abort an in-flight
 * supabase-js fetch — so clicks go out via navigator.sendBeacon (survives
 * unload; apikey rides as a query param since sendBeacon can't set
 * headers), with a keepalive fetch fallback. Same privacy posture as the
 * page-view beacon: the RPC hashes IP/UA server-side, nothing identifying
 * leaves the function, no consent gate applies.
 */
function beaconCtaClick(cta: string, path: string): void {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/record_cta_click?apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
    const body = JSON.stringify({ p_cta: cta, p_path: path, p_lookup_key: null });
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics never break the page.
  }
}

interface Props {
  /** False on a private page (MarketingLayout noThirdPartyTags: /starter/downloads,
   *  /partner-sample). The page then loads no Meta Pixel, even for a visitor who
   *  clicked Accept elsewhere, and shows no cookie banner, because the layout has
   *  already left out Google Analytics, GTM and the Pinterest tag and nothing
   *  left needs consent. The cookieless first-party page view (the path, the
   *  referrer and the utm_* values, never the t or k credential) and the CTA
   *  click beacon still run. Defaults to true. */
  thirdPartyTags?: boolean;
}

export default function SiteAnalytics({ thirdPartyTags = true }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 0. Record first-touch attribution before anything else, so a visitor who
    //    lands on a tagged link and navigates before signing up is still
    //    credited to the link rather than to this site.
    captureFirstTouch();

    // 1. Cookieless first-party page view (no consent required).
    const path = window.location.pathname;
    if (!SKIP_PREFIXES.some((p) => path.startsWith(p))) {
      const params = new URLSearchParams(window.location.search);
      void supabase
        .rpc("record_page_view" as never, {
          p_path: path,
          p_referrer: document.referrer || null,
          p_utm_source: params.get("utm_source"),
          p_utm_medium: params.get("utm_medium"),
          p_utm_campaign: params.get("utm_campaign"),
        } as never)
        .then(
          () => {},
          () => {},
        );
    }

    // 1b. CRO Phase 4: delegated [data-cta] click beacon (capture phase so
    // no future stopPropagation can hide a CTA from measurement).
    let lastKey = "";
    let lastAt = 0;
    const clickHandler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const el = target.closest("[data-cta]");
      if (!el) return;
      const cta = el.getAttribute("data-cta");
      if (!cta) return;
      const key = `${cta}|${window.location.pathname}`;
      const now = Date.now();
      if (key === lastKey && now - lastAt < 800) return;
      lastKey = key;
      lastAt = now;
      beaconCtaClick(cta, window.location.pathname);
    };
    document.addEventListener("click", clickHandler, true);

    const cleanup = () => document.removeEventListener("click", clickHandler, true);

    // A private page stops here: no Meta Pixel and no banner (see Props).
    if (!thirdPartyTags) return cleanup;

    // 2. Consent-gated Meta Pixel PageView (returning consented visitors).
    if (getMarketingConsent() === "granted") {
      loadMetaPixel();
      metaPageView();
    }

    // 3. Show the consent banner only if the visitor hasn't chosen yet.
    if (getMarketingConsent() === null) setVisible(true);

    return cleanup;
  }, [thirdPartyTags]);

  if (!visible || !thirdPartyTags) return null;

  // The shared banner (src/components/ConsentBanner.tsx) stores the choice,
  // applies it to Google Analytics and the Pinterest tag (default on, Decline
  // turns them off; the layout's inline script re-applies a stored Decline on
  // every load) and loads the Meta Pixel on Accept.
  return <ConsentBannerView onChoice={() => setVisible(false)} />;
}
