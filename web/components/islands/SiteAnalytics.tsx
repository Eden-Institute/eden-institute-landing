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
import { getMarketingConsent, setMarketingConsent } from "@/lib/consent";
import { loadMetaPixel, metaPageView } from "@/lib/metaPixel";
import { Button } from "@/components/ui/button";

const SKIP_PREFIXES = ["/founder", "/apothecary/auth", "/apothecary/account"];

export default function SiteAnalytics() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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

    // 2. Consent-gated Meta Pixel PageView (returning consented visitors).
    if (getMarketingConsent() === "granted") {
      loadMetaPixel();
      metaPageView();
    }

    // 3. Show the consent banner only if the visitor hasn't chosen yet.
    if (getMarketingConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    setMarketingConsent("granted");
    loadMetaPixel();
    metaPageView();
    setVisible(false);
  };
  const decline = () => {
    setMarketingConsent("denied");
    setVisible(false);
  };

  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed bottom-0 inset-x-0 z-[60] px-4 pb-4">
      <div
        className="max-w-3xl mx-auto rounded-lg shadow-lg p-5 sm:flex sm:items-center sm:gap-5"
        style={{ backgroundColor: "hsl(var(--eden-bark))", color: "white" }}
      >
        <p className="font-body text-sm leading-relaxed mb-4 sm:mb-0 sm:flex-1">
          We use a few cookies to understand traffic and measure our ads. You can accept or decline
          marketing cookies — essential, privacy-safe analytics stay on either way. See our{" "}
          <a href="/cookies" className="underline" style={{ color: "hsl(var(--eden-gold))" }}>
            Cookie Policy
          </a>
          .
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="font-accent text-xs tracking-wider uppercase px-4 py-2 rounded-sm border border-white/40 hover:bg-white/10 transition-colors"
          >
            Decline
          </button>
          <Button variant="eden-gold" size="sm" onClick={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
