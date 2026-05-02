import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { ApothecaryNav } from "./ApothecaryNav";
import { ApothecaryErrorBoundary } from "./ApothecaryErrorBoundary";
import { PageSkeleton } from "./PageSkeleton";

/**
 * Global layout shell for every /apothecary/* route. Wraps the outlet in:
 * - ApothecaryErrorBoundary (single generic fallback per §23.7)
 * - Suspense (with PageSkeleton for lazy-loaded surfaces)
 *
 * Active-profile context is NOT mounted here. Per PR β (2026-05-02), the
 * ActiveProfileProvider was hoisted to App.tsx so the active-profile
 * selection persists across every route — including the marketing
 * homepage. Mounting it here AGAIN would create a nested duplicate
 * provider, and consumers further down would read state scoped to this
 * layout's mount lifetime instead of the global one — re-introducing the
 * Olivia-reverts-to-primary-Pattern-on-Home bug PR β just fixed. The
 * provider lives ONCE, at App scope, alongside AuthProvider.
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
  );
}
