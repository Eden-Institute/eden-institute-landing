import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/lib/routes";
import { PageSkeleton } from "./PageSkeleton";

/**
 * Redirects unauthenticated visitors to /apothecary/auth/signin with a
 * return_to query param so they come back to the intended surface after login.
 * Renders PageSkeleton while the initial session check is in flight.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSkeleton />;

  if (!user) {
    const returnTo = location.pathname + location.search;
    return (
      <Navigate
        to={`${ROUTES.APOTHECARY_SIGNIN}?return_to=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
