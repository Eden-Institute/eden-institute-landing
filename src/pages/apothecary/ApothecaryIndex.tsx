import { useAuth } from "@/contexts/AuthContext";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";
import ApothecaryHome from "./ApothecaryHome";
import ApothecaryWelcome from "./ApothecaryWelcome";

/**
 * ApothecaryIndex — auth-branching element for the bare /apothecary
 * layout index (CRO Phase 1).
 *
 * Signed-in users get the directory (ApothecaryHome) exactly as before;
 * anonymous visitors get the quiz-led value page (ApothecaryWelcome)
 * instead of the old RequireAuth bounce to the sign-in form.
 *
 * This MUST stay a single branching index element. Splitting into two
 * sibling routes doesn't work — a non-index sibling at the same path
 * loses React Router's ranked matching to the index route (the exact
 * bug that made the old AppPage dead code). And the ~13 in-app links
 * that point at bare ROUTES.APOTHECARY (nav Home, post-signin default,
 * welcome tour, etc.) all expect the authed directory here, which the
 * user branch preserves.
 *
 * The loading gate mirrors RequireAuth: render PageSkeleton until auth
 * resolves so signed-in users never flash marketing content.
 */
export default function ApothecaryIndex() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  return user ? <ApothecaryHome /> : <ApothecaryWelcome />;
}
