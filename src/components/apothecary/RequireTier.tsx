import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentTier, Tier } from "@/hooks/useCurrentTier";
import { PageSkeleton } from "./PageSkeleton";

interface Props {
  allow: Tier[];
  children: ReactNode;
  fallback?: ReactNode;
}

const tierCopy: Record<Tier, string> = {
  anon: "Visitors",
  free: "Free tier",
  seed: "Seed tier",
  root: "Root tier",
  practitioner: "Practitioner tier",
};

/**
 * Client-side tier gate. Reads useCurrentTier() and either renders children or
 * shows a paywall CTA to /apothecary/pricing. This is UX only — the data itself
 * is guarded by Postgres RLS + tier-gated views per Locked Decision §0.8.
 * Never rely on this component as the security boundary.
 */
export function RequireTier({ allow, children, fallback }: Props) {
  const { data: tier, isLoading } = useCurrentTier();

  if (isLoading) return <PageSkeleton />;

  if (!tier || !allow.includes(tier)) {
    if (fallback) return <>{fallback}</>;
    const minTier = allow[0] ?? "seed";
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <Lock
            className="w-10 h-10 mx-auto"
            style={{ color: "hsl(var(--eden-gold))" }}
          />
          <h2
            className="font-serif text-2xl font-semibold"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            {tierCopy[minTier]} required
          </h2>
          <p className="font-body text-sm text-muted-foreground">
            This content is available to subscribers on the{" "}
            {tierCopy[minTier]} or higher. Choose a plan to continue.
          </p>
          <Button variant="eden" asChild>
            <Link to="/apothecary/pricing">View plans</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
