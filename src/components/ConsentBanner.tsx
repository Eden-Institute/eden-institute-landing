// The one cookie consent banner, rendered by both rendering paths:
//   - the SPA mounts the default export once in src/App.tsx;
//   - Astro pages render <ConsentBannerView> from
//     web/components/islands/SiteAnalytics.tsx, which decides when to show it.
//
// CONSENT MODEL (founder decision 2026-09-13, see src/lib/consent.ts): Google
// Analytics and the Pinterest tag run by default and Decline turns them off;
// the Meta Pixel loads only after Accept; the first-party cookie-free page
// counts (record_page_view) run either way. The wording below says exactly
// that (founder-approved text, 2026-09-15). Change the text and the model
// together, never one without the other.
//
// No react-router here: the Astro island has no router, so the Cookie Policy
// link is a plain <a href>.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { applyTagConsent, getMarketingConsent, setMarketingConsent } from "@/lib/consent";
import { loadMetaPixel, metaPageView } from "@/lib/metaPixel";
import { ASTRO_PAGES } from "@/lib/routes";

/**
 * The banner itself. Stores the choice, applies it to the default-on tags,
 * loads the Meta Pixel on Accept, then calls onChoice so the parent can hide it.
 */
export function ConsentBannerView({ onChoice }: { onChoice: () => void }) {
  const accept = () => {
    setMarketingConsent("granted");
    applyTagConsent("granted");
    loadMetaPixel();
    metaPageView(); // first PageView for this session now that consent is given
    onChoice();
  };
  const decline = () => {
    setMarketingConsent("denied");
    applyTagConsent("denied");
    onChoice();
  };

  return (
    <div role="region" aria-label="Cookie consent" className="fixed bottom-0 inset-x-0 z-[60] px-4 pb-4">
      <div
        className="max-w-3xl mx-auto rounded-lg shadow-lg p-5 sm:flex sm:items-center sm:gap-5"
        style={{ backgroundColor: "hsl(var(--eden-bark))", color: "white" }}
      >
        <p className="font-body text-sm leading-relaxed mb-4 sm:mb-0 sm:flex-1">
          We use a few cookies to understand traffic and measure our ads. Google Analytics and
          Pinterest are on unless you tap Decline. Our Meta ad pixel only turns on if you tap
          Accept. Our own cookie-free page counts stay on either way. See our{" "}
          <a href={ASTRO_PAGES.COOKIES} className="underline" style={{ color: "hsl(var(--eden-gold))" }}>
            Cookie Policy
          </a>
          .
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            type="button"
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

/**
 * SPA mount (src/App.tsx). Shows once until a choice is stored. index.html
 * re-applies a stored Decline to Google Analytics on every load; the SPA has no
 * Pinterest tag, and applyTagConsent skips a tag that is absent.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(() => getMarketingConsent() === null);
  if (!visible) return null;
  return <ConsentBannerView onChoice={() => setVisible(false)} />;
}
