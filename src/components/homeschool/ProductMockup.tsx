import { useState } from "react";
import BotanicalPlaceholder from "./BotanicalPlaceholder";

/**
 * ProductMockup — image-or-placeholder atom for product cards and hero.
 *
 * Behavior:
 *  • If imageSrc is null/undefined, render BotanicalPlaceholder directly.
 *  • If imageSrc is present, render an <img> and use onError to swap to
 *    BotanicalPlaceholder if the asset 404s (e.g., during the window where
 *    data.ts paths point at a file that hasn't been uploaded yet, or when
 *    a filename drifts post-launch).
 *
 * Why onError instead of waiting for the asset commit: it makes the PR
 * preview robust during the asset-handoff window. Camila can review the
 * page structure without needing the PNGs to land first; the moment she
 * drops them into /public/homeschool-mockups/, the cards swap to photos
 * on the next Vercel rebuild — no code touch.
 */
export interface ProductMockupProps {
  imageSrc?: string | null;
  productName: string;
  /** Aspect ratio of the slot; defaults to 4/3 (matches product card spec). */
  aspect?: string;
  /** When true, force BotanicalPlaceholder — used for GJ/FD where no master
   *  is planned for v1 launch. */
  forcePlaceholder?: boolean;
  /** Override the placeholder caption (e.g., "In production" for GJ/FD). */
  placeholderCaption?: string;
}

export default function ProductMockup({
  imageSrc,
  productName,
  aspect = "aspect-[4/3]",
  forcePlaceholder = false,
  placeholderCaption,
}: ProductMockupProps) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = forcePlaceholder || !imageSrc || failed;

  return (
    <div className={`${aspect} w-full overflow-hidden`}>
      {showPlaceholder ? (
        <BotanicalPlaceholder
          productName={productName}
          captionOverride={placeholderCaption}
        />
      ) : (
        <img
          src={imageSrc ?? ""}
          alt={`${productName} — Eden's Table product mockup`}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
