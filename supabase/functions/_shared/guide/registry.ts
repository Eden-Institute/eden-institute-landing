// _shared/guide/registry.ts
//
// Single server-side source of truth for the paid Deep-Dive Guide content.
// Imported by constitution-pdf (renders the PDF) and verify-session (returns the
// structured content to the /guide page only after a purchase is verified).
//
// The guide text deliberately lives ONLY here, server-side. It is not bundled into
// the public client JS — the /guide page fetches it through verify-session after a
// paid Stripe session is confirmed, so the $4.99 product is not readable for free.

import type { FullGuideContent } from "./guide-types.ts";
import { burningBowstringGuide } from "./guide-content-burning-bowstring.ts";
import { drawnBowstringGuide } from "./guide-content-drawn-bowstring.ts";
import { frozenKnotGuide } from "./guide-content-frozen-knot.ts";
import { openFlameGuide } from "./guide-content-open-flame.ts";
import { overflowingCupGuide } from "./guide-content-overflowing-cup.ts";
import { pressureCookerGuide } from "./guide-content-pressure-cooker.ts";
import { spentCandleGuide } from "./guide-content-spent-candle.ts";
import { stillWaterGuide } from "./guide-content-still-water.ts";

const ALL_GUIDES: FullGuideContent[] = [
  burningBowstringGuide,
  drawnBowstringGuide,
  frozenKnotGuide,
  openFlameGuide,
  overflowingCupGuide,
  pressureCookerGuide,
  spentCandleGuide,
  stillWaterGuide,
];

// Each guide object carries its own slug ("frozen-knot") and nickname
// ("The Frozen Knot"), so both lookup maps derive from the content itself.
export const GUIDES_BY_SLUG: Record<string, FullGuideContent> = Object.fromEntries(
  ALL_GUIDES.map((g) => [g.slug, g]),
);
const GUIDES_BY_NICKNAME: Record<string, FullGuideContent> = Object.fromEntries(
  ALL_GUIDES.map((g) => [g.nickname, g]),
);

export function getGuideBySlug(slug: string): FullGuideContent | null {
  return GUIDES_BY_SLUG[slug.toLowerCase().trim()] ?? null;
}

export function getGuideByNickname(nickname: string): FullGuideContent | null {
  return GUIDES_BY_NICKNAME[nickname.trim()] ?? null;
}
