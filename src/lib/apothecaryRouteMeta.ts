// The head of each public Eden Apothecary app route, in one place (2026-10-28).
//
// The page component passes it to useDocumentMeta, and the build writes the same
// title, description and canonical into that route's raw HTML
// (web/pages/apothecary-heads.json.ts -> scripts/build-apothecary-shells.mjs), so a
// crawler or a link preview that never runs JavaScript sees the page's own head,
// not the SPA shell's. Wording unchanged from what each component carried.
//
// Only the public routes are here. Sign-in, account, profiles, favorites, quiz and
// the welcome pages are behind an account and keep the plain shell.

import { HERB_CATALOG_SIZE } from "@/lib/herbCatalog";

export interface RouteMeta {
  path: string;
  title: string;
  description: string;
  canonical: string;
}

export const APOTHECARY_HOME_META: RouteMeta = {
  path: "/apothecary",
  title: "Eden Apothecary | Body Pattern Herb Guide | The Eden Institute",
  description:
    "Find your body pattern with the free 2-minute quiz and meet the herbs that fit it. Rooted in Biblical terrain medicine. Built for Christian families.",
  canonical: "https://edeninstitute.health/apothecary",
};

export const APOTHECARY_PRICING_META: RouteMeta = {
  path: "/apothecary/pricing",
  title: "Pricing | Eden Apothecary",
  description:
    "Free access to the herb directory and the Pattern quiz. Seed, Root, and Practitioner tiers open the full clinical depth: actions, tissue states, contraindications, and a one-screen practitioner clinic.",
  canonical: "https://edeninstitute.health/apothecary/pricing",
};

export const APOTHECARY_START_META: RouteMeta = {
  path: "/apothecary/start",
  title: "Plans & Getting Started | Eden Apothecary",
  description: `Start with the free 2-minute Pattern of Eden quiz, then choose your depth: ${HERB_CATALOG_SIZE} herbs anchored to body patterns, tissue states, and stewardship. Free for as long as you'd like.`,
  canonical: "https://edeninstitute.health/apothecary/start",
};

export const APOTHECARY_PUBLIC_ROUTES: RouteMeta[] = [APOTHECARY_HOME_META, APOTHECARY_PRICING_META, APOTHECARY_START_META];
