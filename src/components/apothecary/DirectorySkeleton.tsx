import { Skeleton } from "@/components/ui/skeleton";

/**
 * DirectorySkeleton — loading state shaped like the ApothecaryHome page
 * (CRO Phase 2, plan §6: skeleton screens, no layout jank).
 *
 * The generic PageSkeleton is a narrow centered column shared by
 * RequireAuth/RequireTier/Suspense; swapping it for real directory content
 * (full-bleed cream hero + filter panel + 3-column grid) was the single
 * biggest layout shift on the page. This skeleton mirrors the real
 * geometry — hero band, filter panel, six card blocks in the same grid —
 * so first paint and loaded state agree.
 *
 * Keep the section paddings/max-widths in sync with ApothecaryHome.
 */
export function DirectorySkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading the herb directory">
      {/* Hero band (mirrors ApothecaryHome's cream header section) */}
      <section
        className="px-6 py-12"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-5 w-5/6 max-w-xl" />
        </div>
      </section>

      {/* Filter panel + grid (mirrors the max-w-6xl directory section) */}
      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <div
            className="rounded-lg border p-5 space-y-4"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <Skeleton className="h-9 w-full" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="rounded-lg border p-5 space-y-3"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
