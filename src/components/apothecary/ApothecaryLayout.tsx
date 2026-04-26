import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import Footer from "@/components/landing/Footer";
import { ApothecaryNav } from "./ApothecaryNav";
import { ApothecaryErrorBoundary } from "./ApothecaryErrorBoundary";
import { PageSkeleton } from "./PageSkeleton";
import { ActiveProfileProvider } from "@/contexts/ActiveProfileContext";

/**
 * Global layout shell for every /apothecary/* route. Wraps the outlet in:
 * - ActiveProfileProvider (Stage 6.3.5 Phase B sub-task 4 — picks up the user's
 *   person_profiles list once authenticated; provides the active-profile state
 *   that ProfilePicker, useDiagnosticProfile, and useEdenPattern consume.
 *   Tier-blind: every authed tier gets the provider; the picker UI gates itself.)
 * - ApothecaryErrorBoundary (single generic fallback per §23.7)
 * - Suspense (with PageSkeleton for lazy-loaded surfaces)
 *
 * Nav and Footer are shared across all Apothecary routes including auth pages.
 * The ActiveProfileProvider must wrap both — ApothecaryNav reads activeProfile
 * for the picker pill, and Outlet's pages read activeProfile for diagnostic
 * data scoping.
 */
export function ApothecaryLayout() {
  return (
    <ActiveProfileProvider>
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
    </ActiveProfileProvider>
  );
}
