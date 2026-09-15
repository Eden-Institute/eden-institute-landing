// HomeJourneyPersonalizer — client:only island for the Astro homepage.
//
// The static page renders the NO-PATTERN defaults: Steps 2 & 3 and the footer
// "Deep Dive Guide" all link to /assessment (correct for anonymous/first-time/
// crawler traffic). This island restores the returning-visitor personalization
// the React Index.tsx did inline: it reads localStorage.edenConstitutionSlug and,
// when a Pattern is present, rewrites those CTAs to the visitor's personalized
// guide + matched Amazon bundle.
//
// Mirrors the original logic exactly:
//   const guideUrl  = `/guide/${slug}`
//   const bundleUrl = getAmazonKitUrl(slug)
//   Step 2  -> href guideUrl,  label "Unlock with Quiz"
//   Step 3  -> href bundleUrl (if any), label "Browse Bundles", opens new tab
//   Footer  -> href guideUrl
//
// localStorage only — NO Supabase. Renders null; it just mutates the existing
// static anchors (selected by data-cta), like WaitlistController.

import { useEffect } from "react";
import { getAmazonKitUrl } from "@/lib/amazonKitUrls";
import { CONSTITUTION_MAP } from "@/lib/constitution-utils";

const VALID_SLUGS = new Set(Object.values(CONSTITUTION_MAP).map((v) => v.slug));

export default function HomeJourneyPersonalizer() {
  useEffect(() => {
    let slug: string | null = null;
    try {
      // No current writer of this key exists (verified 2026-09-15); personalization only fires for legacy values.
      slug = window.localStorage.getItem("edenConstitutionSlug");
    } catch {
      slug = null;
    }
    if (!slug || !VALID_SLUGS.has(slug)) return;

    const guideUrl = `/guide/${slug}`;

    // Step 2 + footer "Deep Dive Guide" -> the visitor's personalized guide.
    document
      .querySelectorAll<HTMLAnchorElement>('[data-cta="home-step2-guide"]')
      .forEach((el) => {
        el.setAttribute("href", guideUrl);
        el.textContent = "Unlock with Quiz";
      });
    document
      .querySelectorAll<HTMLAnchorElement>('[data-cta="home-footer-guide"]')
      .forEach((el) => {
        el.setAttribute("href", guideUrl);
      });

    // Step 3 -> the Pattern's matched Amazon bundle, only when one exists.
    const bundleUrl = getAmazonKitUrl(slug);
    if (bundleUrl) {
      document
        .querySelectorAll<HTMLAnchorElement>('[data-cta="home-step3-bundle"]')
        .forEach((el) => {
          el.setAttribute("href", bundleUrl);
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer sponsored");
          el.textContent = "Browse Bundles";
        });
    }
  }, []);

  return null;
}
