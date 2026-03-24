import type { FullGuideContent } from "./guide-types";
import { frozenKnotGuide } from "./guide-content-frozen-knot";
import { burningBowstringGuide } from "./guide-content-burning-bowstring";

// Registry of full guide content keyed by nickname slug
const guideRegistry: Record<string, FullGuideContent> = {
  "The Frozen Knot": frozenKnotGuide,
  "The Burning Bowstring": burningBowstringGuide,
};

export function getFullGuide(nickname: string): FullGuideContent | null {
  return guideRegistry[nickname] || null;
}
