import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic loading skeleton for any Apothecary surface. Used by ApothecaryLayout's
 * <Suspense fallback> and by RequireAuth / RequireTier while auth/tier resolve.
 */
export function PageSkeleton() {
  return (
    <div className="min-h-[50vh] px-6 py-12">
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
