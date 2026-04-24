import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import Footer from "@/components/landing/Footer";
import { ApothecaryNav } from "./ApothecaryNav";
import { ApothecaryErrorBoundary } from "./ApothecaryErrorBoundary";
import { PageSkeleton } from "./PageSkeleton";

/**
 * Global layout shell for every /apothecary/* route. Wraps the outlet in:
 *   - ApothecaryErrorBoundary  (single generic fallback per §23.7)
 *   - Suspense                 (with PageSkeleton for lazy-loaded surfaces)
 *
 * Nav and Footer are shared across all Apothecary routes including auth pages.
 */
export function ApothecaryLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ApothecaryNav />
      <main className="flex-1">
        <ApothecaryErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </ApothecaryErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
