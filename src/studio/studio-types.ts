// Shared types across the /studio boundary.
//
// These describe what crosses between the React shell and the database: the
// project row's jsonb columns and the vocabulary the entry screen speaks. They
// outlived the vanilla core that first needed them, and are kept because the
// shell and the edge functions still have to agree on these shapes.

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

/** The project row's `state` jsonb.
 *
 *  The flow keeps its answers under `flow`. The column stays open-ended on
 *  purpose: it is where the export step records what it produced, and older
 *  campaigns saved by the five-screen wizard still have to load without
 *  throwing, even though nothing reads their shape any more. */
export interface StudioStateBlob {
  /** The ad flow's answers. See FlowAnswers in flow-graph.ts. */
  flow?: Record<string, unknown>;
  [key: string]: unknown;
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

/** Products the AI copy brief understands. Mirrors PRODUCTS in studio-banks.ts;
 *  kept in sync by hand because the core owns the full copy bank. */
export const PRODUCT_CHOICES = [
  { id: "kit", label: "Eden's Table · Curriculum Kit", tag: "$249 founders" },
  { id: "course", label: "Back to Eden: Foundations", tag: "$97 founding" },
  { id: "quiz", label: "Constitutional Quiz", tag: "free · lead gen" },
  { id: "apothecary", label: "The Eden Apothecary", tag: "membership" },
  { id: "practitioner", label: "Practitioner Program", tag: "$49.99/mo founding" },
] as const;

/** Ad type drives the canvas size the creative builder opens at. */
/** The inverse of formatForAdType: the flow answers in canvas formats, the
 *  project row stores the ad type the archive filters on. Story covers both
 *  Story and Reel, which are the same 9:16 canvas. */
export function adTypeForFormat(format: string): string {
  if (format === "story") return "story";
  if (format === "carousel") return "carousel";
  return "feed";
}

export function formatForAdType(adType: string): string {
  if (adType === "reel" || adType === "story") return "story";
  if (adType === "carousel") return "carousel";
  return "portrait";
}
