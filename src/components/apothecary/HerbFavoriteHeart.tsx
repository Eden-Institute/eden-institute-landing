import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { useHerbFavorites } from "@/hooks/useHerbFavorites";

interface HerbFavoriteHeartProps {
  /** The herb_id (text, slug-shaped — e.g. "ashwagandha") to toggle. */
  herbId: string;
  /**
   * Optional className override. The default class positions the
   * heart absolute top-right of the closest `relative` ancestor; the
   * caller is responsible for adding `relative` to the wrapping
   * article or container.
   */
  className?: string;
}

/**
 * HerbFavoriteHeart — the heart icon button rendered on every
 * unlocked HerbCard.
 *
 * Per Camila's Decision 4 (2026-04-30): Seed+ tier toggles favoriting;
 * Free user click navigates to /apothecary/pricing#tier-seed (the
 * seed upgrade anchor from PR #97). Authed Seed+ click toggles
 * optimistically via useHerbFavorites.
 *
 * Visual:
 *   • Filled gold when favorited.
 *   • Outline bark/50 when not.
 *   • Hover background = eden-cream.
 *   • Tap target ≥44×44px per the project mobile spec
 *     (project_mobile_wrapping_roadmap.md).
 *
 * Event handling:
 *   • stopPropagation + preventDefault on click so clicking the heart
 *     doesn't accidentally trigger the parent HerbCard's expand/
 *     collapse handler or any future click-to-detail navigation.
 *
 * Loading state:
 *   • Button disabled while the initial favorites query is in-flight.
 *     After resolution, optimistic UI keeps the heart responsive.
 */
export function HerbFavoriteHeart({
  herbId,
  className = "",
}: HerbFavoriteHeartProps) {
  const { isFavorite, toggleFavorite, canFavorite, isLoading } =
    useHerbFavorites();
  const navigate = useNavigate();

  const fav = isFavorite(herbId);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canFavorite) {
      // Free / no-profile users: redirect to upgrade prompt rather
      // than show a disabled error state. The pricing page #tier-seed
      // anchor exists per PR #97.
      navigate("/apothecary/pricing#tier-seed");
      return;
    }
    void toggleFavorite(herbId).catch((err) => {
      console.error("[HerbFavoriteHeart] toggle failed:", err);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      aria-label={
        fav ? `Remove ${herbId} from favorites` : `Save ${herbId} to favorites`
      }
      aria-pressed={fav}
      className={`absolute top-3 right-3 z-10 p-2 rounded-full transition-colors hover:bg-[hsl(var(--eden-cream))] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center ${className}`}
      style={{
        color: fav
          ? "hsl(var(--eden-gold))"
          : "hsl(var(--eden-bark) / 0.5)",
      }}
    >
      <Heart
        className="w-5 h-5"
        fill={fav ? "currentColor" : "none"}
        strokeWidth={2}
        aria-hidden="true"
      />
    </button>
  );
}
