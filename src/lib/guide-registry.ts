import type { FullGuideContent } from "./guide-types";
import { frozenKnotGuide } from "./guide-content-frozen-knot";
import { burningBowstringGuide } from "./guide-content-burning-bowstring";
import { stillWaterGuide } from "./guide-content-still-water";
import { spentCandleGuide } from "./guide-content-spent-candle";

// Registry of full guide content keyed by nickname slug
const guideRegistry: Record<string, FullGuideContent> = {
  "The Frozen Knot": frozenKnotGuide,
  "The Burning Bowstring": burningBowstringGuide,
  "The Still Water": stillWaterGuide,
  "The Spent Candle": spentCandleGuide,
};

export function getFullGuide(nickname: string): FullGuideContent | null {
  return guideRegistry[nickname] || null;
}
