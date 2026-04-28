import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import Navbar from "@/components/landing/Navbar";
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
 * Header stack (v3.34 Item I — closes founder-reported "missing hamburger" on
 * /apothecary/auth/signin and other /apothecary/* surfaces):
 *   1. Global Navbar (top) — marketing-site nav links + hamburger menu so
 *      visitors can always navigate back to /, /why-eden, /courses, etc.
 *      regardless of which Apothecary surface they're on.
 *   2. ApothecaryNav (below) — Apothecary-specific in-app header (logo,
 *      profile picker for Root tier, sign-out, etc.).
 * Camila's v3.34 directive: "Apothecary header stays for authenticated state"
 * — both visible. Vercel preview lets founder decide if the visual stacking
 * needs further design polish.
 */
export function ApothecaryLayout() {
  return (
    <ActiveProfileProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
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
