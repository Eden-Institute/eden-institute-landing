import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useHerbFavorites } from "@/hooks/useHerbFavorites";
import { ROUTES } from "@/lib/routes";

interface HerbFavoriteHeartProps {
  /** The herb_id to toggle — the DB H-code (e.g. "H001"), used as the key. */
  herbId: string;
  /**
   * Human-readable herb name for the accessible label. Without it the
   * aria-label falls back to the raw H-code ("Save H001 to favorites"),
   * which is meaningless to screen-reader users — pass common_name
   * whenever the caller has it.
   */
  herbName?: string;
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
  herbName,
  className = "",
}: HerbFavoriteHeartProps) {
  const {
    isFavorite,
    toggleFavorite,
    canFavorite,
    favoriteBlockReason,
    isAtFreeCap,
    isLoading,
  } = useHerbFavorites();
  const navigate = useNavigate();

  const fav = isFavorite(herbId);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // A Seed+ subscriber with no active profile is prompted to pick one, never
    // sent to buy a feature they already own.
    if (!canFavorite) {
      if (favoriteBlockReason === "no-profile") {
        toast("Pick a profile to save herbs to", {
          description: "Each family member's profile keeps its own herb list.",
          action: {
            label: "Choose profile",
            onClick: () => navigate(ROUTES.APOTHECARY_PROFILES),
          },
        });
      }
      return;
    }
    // Free tier has a small local save list; hitting the cap is a Seed moment.
    if (isAtFreeCap && !fav) {
      toast("Your free list is full (3 herbs)", {
        description: "Seed saves unlimited herbs, organized per family member.",
        action: {
          label: "See Seed",
          onClick: () => navigate(`${ROUTES.APOTHECARY_PRICING}#tier-seed`),
        },
      });
      return;
    }
    void toggleFavorite(herbId).catch((err) => {
      console.error("[HerbFavoriteHeart] toggle failed:", err);
      toast.error("Could not update your saved herbs. Please try again.");
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      aria-label={
        fav
          ? `Remove ${herbName ?? herbId} from favorites`
          : `Save ${herbName ?? herbId} to favorites`
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
