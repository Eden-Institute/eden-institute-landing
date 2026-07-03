// src/components/utils/CtaClickTracker.tsx
//
// CRO Phase 4 (plan §14): delegated CTA click beacon. One document-level
// CAPTURE-phase listener records a cookieless event for every click on (or
// inside) an element carrying data-cta — zero per-component wiring, and
// every data-cta shipped in Phases 0-3 becomes measurable at once.
//
// Capture phase on purpose: it runs before React's synthetic handlers and
// before any stopPropagation (HerbFavoriteHeart already stops propagation;
// nothing with a data-cta does today, but the tracker is immune by
// construction). Mounted once in App, sibling of PageViewTracker.
//
// Skip list deliberately DIFFERS from PageViewTracker's: only /founder is
// excluded (the founder's own dashboard clicks would pollute the funnel).
// /apothecary/account is tracked — the JourneyCTA lives there and was a
// documented measurement blind spot.

import { useEffect, useRef } from "react";
import { trackCta } from "@/lib/trackCta";

const SKIP_PREFIXES = ["/founder"];

export default function CtaClickTracker() {
  const lastFire = useRef<{ key: string; at: number }>({ key: "", at: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const el = target.closest("[data-cta]");
      if (!el) return;
      const cta = el.getAttribute("data-cta");
      if (!cta) return;
      const path = window.location.pathname;
      if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return;
      // Double-click / event-quirk dedupe: same cta on the same path
      // within 800ms counts once.
      const key = `${cta}|${path}`;
      const now = Date.now();
      if (lastFire.current.key === key && now - lastFire.current.at < 800) {
        return;
      }
      lastFire.current = { key, at: now };
      trackCta(cta, { path });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return null;
}
