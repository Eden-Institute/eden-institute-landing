import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProfileOptional } from "@/contexts/ActiveProfileContext";
import { useCurrentTier } from "@/hooks/useCurrentTier";

/**
 * useHerbFavorites — active-profile-scoped herb favorites.
 *
 * Per Camila's Decision 4 (2026-04-30): favorites are scoped to the
 * active person_profile, not to the user. Each family member's profile
 * has its own list. The DB shape (PR #103) keys herb_favorites on
 * person_profile_id; this hook is the React surface.
 *
 * Tier gating per Decision 4(b): Seed and up. Free users get
 * canFavorite=false; toggleFavorite throws. The DB-side gating is
 * implicit — Free has cap=0 person_profiles so they can't FK into a
 * profile to insert a favorite — but the hook enforces explicitly so
 * the UI surfaces the right CTA (upgrade prompt vs disabled button).
 *
 * Architecture: ONE TanStack Query loads the full Set<herb_id> for the
 * active profile in a single round-trip. HerbCard consumers do O(1)
 * isFavorite() checks against the set rather than N+1 queries (one
 * per card). When the picker switches active profile, the query
 * re-keys via active profile id and refetches automatically.
 *
 * Optimistic UI: toggle snapshots the cache, mutates immediately, and
 * rolls back on error. The HerbCard heart fills/empties without a
 * round-trip wait.
 */

const TIERS_WITH_FAVORITES: ReadonlySet<string> = new Set([
  "seed",
  "root",
  "practitioner",
]);

/**
 * Free tier gets a small device-local (localStorage) favorites list. Free users
 * have zero person_profiles, so they cannot write the DB `herb_favorites` table;
 * a capped local list lets them start a study list, and hitting the cap is a
 * natural Seed upsell moment ("Seed makes it unlimited, per family member").
 */
const FREE_FAVORITES_CAP = 3;
const FREE_FAVORITES_KEY = "eden_free_favorites";
const FREE_QUERY_KEY = ["herb_favorites_free"];

function readFreeFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FREE_FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeFreeFavorites(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FREE_FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable (private mode / quota) — non-fatal.
  }
}

export interface UseHerbFavoritesResult {
  /** Set of herb_ids the active profile has favorited. */
  favorites: Set<string>;
  isLoading: boolean;
  /**
   * True if the user's tier permits favoriting AND there's an active
   * profile to attach the favorite to. False for anon, Free, or
   * authed-without-profile states. The HerbFavoriteHeart UI uses this
   * to decide whether toggle is allowed or whether to redirect to the
   * upgrade prompt.
   */
  canFavorite: boolean;
  /**
   * When favoriting is blocked, why — so the UI shows the RIGHT prompt:
   *   "upgrade"    → anon/Free: saving is a Seed feature.
   *   "no-profile" → Seed+ but no active profile: pick/create a profile
   *                  (do NOT send a paying subscriber to the pricing page).
   *   null         → favoriting is allowed.
   */
  favoriteBlockReason: "upgrade" | "no-profile" | null;
  /**
   * True when a non-subscriber has reached the free-tier save cap. The heart
   * uses this to show the "your free list is full — Seed makes it unlimited"
   * upsell instead of saving a 4th herb.
   */
  isAtFreeCap: boolean;
  /** O(1) lookup helper. Always safe to call even when canFavorite=false. */
  isFavorite: (herbId: string) => boolean;
  /**
   * Toggle favorite on/off. Resolves on success, throws if the user
   * isn't permitted (caller should check canFavorite first to surface
   * the upgrade-prompt UI). DB UNIQUE(person_profile_id, herb_id)
   * prevents duplicate inserts under race; concurrent toggles end in
   * a stable state.
   */
  toggleFavorite: (herbId: string) => Promise<void>;
}

export function useHerbFavorites(): UseHerbFavoritesResult {
  const { user } = useAuth();
  const profileCtx = useActiveProfileOptional();
  const activeProfileId = profileCtx?.activeProfile?.id ?? null;
  const { data: tier } = useCurrentTier();
  const queryClient = useQueryClient();

  const isSubscriber = !!tier && TIERS_WITH_FAVORITES.has(tier);

  // Subscriber favorites: DB, profile-scoped, unlimited.
  const dbQueryKey = ["herb_favorites", activeProfileId ?? "none"];
  const dbQuery = useQuery<Set<string>>({
    queryKey: dbQueryKey,
    queryFn: async () => {
      if (!activeProfileId) return new Set<string>();
      const { data, error } = await supabase
        .from("herb_favorites")
        .select("herb_id")
        .eq("person_profile_id", activeProfileId);
      if (error) throw error;
      return new Set<string>((data ?? []).map((row) => row.herb_id as string));
    },
    enabled: isSubscriber && !!activeProfileId,
    staleTime: 60 * 1000, // 1 min — favorites don't change often outside the active session
    gcTime: 30 * 60 * 1000,
  });

  // Free favorites: device-local, capped. Held in the TanStack cache so every
  // HerbCard heart re-renders in sync when the local list changes.
  const freeQuery = useQuery<Set<string>>({
    queryKey: FREE_QUERY_KEY,
    queryFn: async () => new Set<string>(readFreeFavorites()),
    enabled: !isSubscriber,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const favorites = isSubscriber
    ? dbQuery.data ?? new Set<string>()
    : freeQuery.data ?? new Set<string>();
  const isLoading = isSubscriber ? dbQuery.isLoading : freeQuery.isLoading;

  // Free users can favorite (up to the cap). Subscribers need an active profile.
  const canFavorite = isSubscriber ? !!user && !!activeProfileId : true;
  const favoriteBlockReason: "upgrade" | "no-profile" | null =
    isSubscriber && !activeProfileId ? "no-profile" : null;
  const isAtFreeCap = !isSubscriber && favorites.size >= FREE_FAVORITES_CAP;

  const mutation = useMutation<
    void,
    Error,
    string,
    { previous: Set<string> }
  >({
    mutationFn: async (herbId: string) => {
      if (!canFavorite || !activeProfileId) {
        throw new Error(
          "Favoriting requires Seed+ tier and an active profile",
        );
      }
      const isCurrentlyFav = favorites.has(herbId);
      if (isCurrentlyFav) {
        const { error } = await supabase
          .from("herb_favorites")
          .delete()
          .eq("person_profile_id", activeProfileId)
          .eq("herb_id", herbId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("herb_favorites")
          .insert({ person_profile_id: activeProfileId, herb_id: herbId });
        if (error) throw error;
      }
    },
    onMutate: async (herbId: string) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic value.
      await queryClient.cancelQueries({ queryKey: dbQueryKey });
      const previous = queryClient.getQueryData<Set<string>>(dbQueryKey) ??
        new Set<string>();
      const next = new Set(previous);
      if (next.has(herbId)) next.delete(herbId);
      else next.add(herbId);
      queryClient.setQueryData(dbQueryKey, next);
      return { previous };
    },
    onError: (_err, _herbId, context) => {
      // Roll back to the snapshot taken in onMutate.
      if (context?.previous) {
        queryClient.setQueryData(dbQueryKey, context.previous);
      }
    },
    onSettled: () => {
      // Always refetch to reconcile with server truth.
      queryClient.invalidateQueries({ queryKey: dbQueryKey });
    },
  });

  const toggleFavorite = async (herbId: string): Promise<void> => {
    if (isSubscriber) {
      await mutation.mutateAsync(herbId);
      return;
    }
    // Free path: device-local, capped. Removes are always allowed; adds are
    // blocked once the cap is reached (the heart gates this via isAtFreeCap and
    // shows the Seed upsell, so this is a defensive backstop).
    const current = readFreeFavorites();
    const has = current.includes(herbId);
    if (!has && current.length >= FREE_FAVORITES_CAP) return;
    const next = has
      ? current.filter((id) => id !== herbId)
      : [...current, herbId];
    writeFreeFavorites(next);
    queryClient.setQueryData(FREE_QUERY_KEY, new Set<string>(next));
  };

  return {
    favorites,
    isLoading,
    canFavorite,
    favoriteBlockReason,
    isAtFreeCap,
    isFavorite: (herbId: string) => favorites.has(herbId),
    toggleFavorite,
  };
}
