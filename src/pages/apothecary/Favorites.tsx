import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useApothecaryHerbs } from "@/hooks/useApothecaryHerbs";
import { useHerbFavorites } from "@/hooks/useHerbFavorites";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { HerbCard } from "@/components/apothecary/HerbCard";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";
import { RequireAuth } from "@/components/apothecary/RequireAuth";
import { RequireTier } from "@/components/apothecary/RequireTier";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

/**
 * /apothecary/favorites — active-profile save-favorites listing surface.
 *
 * Per Camila's Decision 4 (2026-04-30):
 *   (a) Per-active-profile favorites — the active profile from the picker
 *       drives which favorites we list. Switching profile via the picker
 *       re-keys useHerbFavorites and the page rebuilds.
 *   (b) Seed+ tier gating — enforced via RequireTier wrapper. Free users
 *       see the paywall fallback (cap=0 means they have no profile to
 *       attach favorites to anyway).
 *   (c) Heart icon on HerbCard handles the toggle (PR #104). On THIS
 *       page, tapping the heart removes from favorites and the row
 *       disappears — same hook, same optimistic UI.
 *
 * Design choice: reuse useApothecaryHerbs (which fetches all 100 herbs
 * via the tier-aware herbs_directory_v view) and filter in-memory.
 * Cheap; reuses existing tier gating + Pattern-aware sort + match-badge
 * logic without copy-paste. The favorites set is small (typical user
 * has < 30 saved); the herb dataset is bounded at 100.
 *
 * Sort: by row insertion order from herb_favorites (most-recent-first)
 * — the favorites Set comes from a SELECT without explicit ORDER BY,
 * but in practice Postgres returns rows in insertion order for an
 * append-only table. If launch usage produces complaints, expose
 * explicit sort controls (alphabetical, by Pattern match, by tissue
 * state). Out of scope for this PR.
 */

function FavoritesContent() {
  useDocumentMeta({
    title: "Saved herbs | Eden Apothecary",
    description:
      "Herbs you've saved to revisit. Tap the heart on any herb in the directory to save it here.",
    canonical: "https://edeninstitute.health/apothecary/favorites",
  });

  const {
    data: herbs,
    isLoading: herbsLoading,
    isError,
    error,
  } = useApothecaryHerbs();
  const { favorites, isLoading: favoritesLoading } = useHerbFavorites();
  const { data: activePattern } = useEdenPattern();

  if (herbsLoading || favoritesLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1
          className="font-serif text-2xl font-semibold mb-3"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          We could not load your saved herbs
        </h1>
        <p className="font-body text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please refresh the page."}
        </p>
      </div>
    );
  }

  const favoritedHerbs = herbs.filter((h) => favorites.has(h.herb_id));

  return (
    <div>
      <section
        className="py-12 md:py-16 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-5xl mx-auto">
          <p
            className="font-accent text-xs tracking-[0.3em] uppercase mb-4"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Saved herbs
          </p>
          <h1
            className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Herbs you're coming back to.
          </h1>
          <p className="font-body text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Saved to this profile. Pattern-aware—your match badges still
            apply. Tap the heart on any card to remove it.
          </p>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto">
          {favoritedHerbs.length === 0 ? (
            <div
              className="rounded-lg border p-10 md:p-14 text-center max-w-2xl mx-auto"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <Heart
                className="w-10 h-10 mx-auto mb-4"
                style={{ color: "hsl(var(--eden-gold) / 0.6)" }}
                aria-hidden="true"
              />
              <h2
                className="font-serif text-xl md:text-2xl font-semibold mb-3"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                No favorites yet.
              </h2>
              <p className="font-body text-sm md:text-base text-muted-foreground mb-6">
                Save herbs you want to come back to. Tap the heart on any
                herb in the directory and it'll land here.
              </p>
              <Button variant="eden" size="lg" asChild>
                <Link to={ROUTES.APOTHECARY}>Browse the directory</Link>
              </Button>
            </div>
          ) : (
            <>
              <p
                className="font-accent text-xs tracking-[0.25em] uppercase mb-6"
                style={{ color: "hsl(var(--eden-bark) / 0.7)" }}
              >
                {favoritedHerbs.length}{" "}
                herb{favoritedHerbs.length === 1 ? "" : "s"} saved
              </p>
              <div
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                aria-label="Saved herbs"
              >
                {favoritedHerbs.map((herb) => (
                  <HerbCard
                    key={herb.herb_id}
                    herb={herb}
                    activePattern={activePattern}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Auth + tier gating wrapper. Same pattern as ProfilesPage:
 *   1. RequireAuth — must be authenticated to reach this route.
 *   2. RequireTier — must be Seed+ tier; lower tiers see paywall fallback.
 *   3. RLS — Postgres row-level security on herb_favorites enforces the
 *      person_profile ownership chain server-side, so even a misconfigured
 *      client can't read another user's favorites.
 */
export default function Favorites() {
  return (
    <RequireAuth>
      <RequireTier allow={["seed", "root", "practitioner"]}>
        <FavoritesContent />
      </RequireTier>
    </RequireAuth>
  );
}
