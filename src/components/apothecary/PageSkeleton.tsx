import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic loading skeleton for any Apothecary surface. Used by ApothecaryLayout's
 * <Suspense fallback> and by RequireAuth / RequireTier while auth/tier resolve.
 *
 * min-h-screen, not min-h-[50vh]: at half a screen the site footer rendered
 * inside the first screen while a page loaded, and was then shoved down when
 * the real page arrived. On /apothecary/<herb> that single jump scored 0.24
 * cumulative layout shift in Lighthouse (2026-09-28), "poor" on its own. A full
 * screen keeps the footer below the fold until the page is there. Only the
 * loading state changes; the loaded page is untouched.
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-6 w-1/2" />
        <div className="pt-4 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
