import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * useViewedHerbs — device-local "monographs explored" tracking
 * (CRO Phase 3, plan §11: the retention loop).
 *
 * HerbMonograph records a view on mount; ApothecaryHome (and the monograph
 * itself) read the list for the "You've studied X of N" progress line and
 * the recently-viewed strip. Free-to-paid conversion in a content app is a
 * function of exposure count, so exposure is what we measure and reflect
 * back.
 *
 * Storage: localStorage, H-code herb_ids (same ids as eden_free_favorites),
 * MOST-RECENT-FIRST so the same array serves both recency (strip) and
 * membership (progress count). Capped well above the catalog size so the
 * list never churns. Works for every tier including anon — the monograph
 * is a public page.
 *
 * Mirrored into the TanStack cache (same pattern as useHerbFavorites'
 * free list) so every consumer re-renders in sync when a view is
 * recorded. recordView is idempotent for the already-most-recent id, so
 * StrictMode's dev double-invoke and remounts don't reorder or duplicate.
 */

const VIEWED_KEY = "eden_viewed_herbs";
const VIEWED_QUERY_KEY = ["viewed_herbs"];
const VIEWED_CAP = 200;

function readViewedHerbs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VIEWED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeViewedHerbs(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEWED_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable (private mode / quota) — non-fatal.
  }
}

export interface UseViewedHerbsResult {
  /** Membership lookup — herb_ids ever viewed on this device. */
  viewed: Set<string>;
  /** Most-recent-first herb_ids (drives the recently-viewed strip). */
  viewedOrder: string[];
  /** Record a monograph view. Moves the id to the front; safe to re-call. */
  recordView: (herbId: string) => void;
}

export function useViewedHerbs(): UseViewedHerbsResult {
  const queryClient = useQueryClient();

  const query = useQuery<string[]>({
    queryKey: VIEWED_QUERY_KEY,
    queryFn: async () => readViewedHerbs(),
    // localStorage is the source of truth; it never goes stale on its own.
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const viewedOrder = query.data ?? [];

  const recordView = (herbId: string): void => {
    if (!herbId) return;
    const current = readViewedHerbs();
    const next =
      current[0] === herbId
        ? current // already most recent — skip the localStorage write
        : [herbId, ...current.filter((id) => id !== herbId)].slice(
            0,
            VIEWED_CAP,
          );
    if (next !== current) writeViewedHerbs(next);
    // Cancel any in-flight initial fetch so a resolving queryFn can't
    // overwrite this write (staleTime Infinity would make that stick),
    // and ALWAYS set the cache so it converges on localStorage truth.
    void queryClient.cancelQueries({ queryKey: VIEWED_QUERY_KEY });
    queryClient.setQueryData(VIEWED_QUERY_KEY, next);
  };

  return {
    viewed: new Set(viewedOrder),
    viewedOrder,
    recordView,
  };
}
