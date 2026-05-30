// Cookie consent banner. Marketing cookies (Meta Pixel) fire ONLY on Accept,
// per the Cookie Policy. First-party cookieless analytics is unaffected.
// Shows once until a choice is stored.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getMarketingConsent, setMarketingConsent } from "@/lib/consent";
import { loadMetaPixel, metaPageView } from "@/lib/metaPixel";
import { ROUTES } from "@/lib/routes";

export default function ConsentBanner() {
  const [visible, setVisible] = useState(() => getMarketingConsent() === null);
  if (!visible) return null;

  const accept = () => {
    setMarketingConsent("granted");
    loadMetaPixel();
    metaPageView(); // first PageView for this session now that consent is given
    setVisible(false);
  };
  const decline = () => {
    setMarketingConsent("denied");
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[60] px-4 pb-4"
    >
      <div
        className="max-w-3xl mx-auto rounded-lg shadow-lg p-5 sm:flex sm:items-center sm:gap-5"
        style={{ backgroundColor: "hsl(var(--eden-bark))", color: "white" }}
      >
        <p className="font-body text-sm leading-relaxed mb-4 sm:mb-0 sm:flex-1">
          We use a few cookies to understand traffic and measure our ads. You can accept or
          decline marketing cookies — essential, privacy-safe analytics stay on either way. See our{" "}
          <Link to={ROUTES.COOKIES} className="underline" style={{ color: "hsl(var(--eden-gold))" }}>
            Cookie Policy
          </Link>
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
