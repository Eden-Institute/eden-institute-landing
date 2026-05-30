// Fires Meta Pixel PageView on each client-side navigation — but only if the
// visitor has granted marketing consent. Loads the Pixel lazily on the first
// navigation of a consented session (covers returning visitors who accepted
// in a prior session). No-op for declined / undecided visitors.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getMarketingConsent } from "@/lib/consent";
import { loadMetaPixel, metaPageView } from "@/lib/metaPixel";

export default function MetaPixelTracker() {
  const location = useLocation();

  useEffect(() => {
    if (getMarketingConsent() !== "granted") return;
    loadMetaPixel(); // idempotent — inits once
    metaPageView();
  }, [location.pathname]);

  return null;
}
