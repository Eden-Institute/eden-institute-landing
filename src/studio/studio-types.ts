// Shared types across the /studio boundary.
//
// studio-core.ts is @ts-nocheck (a vanilla-DOM port that predates the React
// shell). These types live here instead so the React side of the seam is fully
// type-checked even though the core is not.

/** One card of an ad. Single-image and video ads carry exactly one; carousel
 *  carries 2 to 10. Modelled as a list from Phase 1 so carousel is a later UI
 *  addition rather than a schema migration. */
export interface StudioSlide {
  id: string;
  /** Storage path in the private `studio-assets` bucket, if this slide has art. */
  assetPath?: string | null;
  headline?: string;
  sub?: string;
  cta?: string;
  /** Canvas template id: label | forest | photo. */
  template?: string;
}

/** The vanilla core's serializable working state. Non-serializable runtime
 *  objects (decoded Images, MediaStreams, AudioContext) are deliberately
 *  excluded: they are rebuilt from the asset library on load. */
export interface StudioStateBlob {
  campaign?: {
    product?: string;
    objective?: string;
    audience?: string;
    angle?: string;
    format?: string;
    gen?: number;
  };
  variants?: unknown[];
  approved?: unknown[];
  builder?: {
    tpl?: string;
    size?: string;
    hook?: string;
    sub?: string;
    cta?: string;
    domain?: string;
    dest?: string;
    qr?: boolean;
  };
  step?: number;
}

/** What initStudio() hands back to the React shell. `destroy` replaces the bare
 *  cleanup function the core returned before Phase 1. */
export interface StudioHandle {
  destroy(): void;
  getState(): StudioStateBlob;
  applyState(blob: StudioStateBlob | null | undefined): void;
  getStep(): number;
  showStep(n: number): void;
}

/** Ad types shipping in v1. Carousel is schema-supported from Phase 1; its
 *  multi-slide UI lands after Phase 7. */
export const AD_TYPES = [
  { id: "feed", label: "Feed post", hint: "Static image, 1:1 or 4:5" },
  { id: "reel", label: "Reel", hint: "Video, 9:16" },
  { id: "story", label: "Story", hint: "Static or video, 9:16" },
  { id: "carousel", label: "Carousel", hint: "2 to 10 cards (slide UI lands later)" },
] as const;

export const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
] as const;

export const CAMPAIGN_TAGS = [
  { id: "sprouts", label: "Sprouts" },
  { id: "seedlings", label: "Seedlings" },
  { id: "cultivators", label: "Cultivators" },
  { id: "unratified", label: "Unratified" },
  { id: "general", label: "General / Other" },
] as const;

/** Products the AI copy brief understands. Mirrors PRODUCTS in studio-core.ts;
 *  kept in sync by hand because the core owns the full copy bank. */
export const PRODUCT_CHOICES = [
  { id: "kit", label: "Eden's Table · Curriculum Kit", tag: "$249 founders" },
  { id: "course", label: "Back to Eden: Foundations", tag: "$97 founding" },
  { id: "quiz", label: "Constitutional Quiz", tag: "free · lead gen" },
  { id: "apothecary", label: "The Eden Apothecary", tag: "membership" },
  { id: "practitioner", label: "Practitioner Program", tag: "$49.99/mo founding" },
] as const;

/** Ad type drives the canvas size the creative builder opens at. */
export function formatForAdType(adType: string): string {
  if (adType === "reel" || adType === "story") return "story";
  if (adType === "carousel") return "carousel";
  return "portrait";
}
