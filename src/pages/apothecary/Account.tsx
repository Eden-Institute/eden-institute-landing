import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTier, Tier } from "@/hooks/useCurrentTier";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";
import { ManageSubscriptionButton } from "@/components/apothecary/ManageSubscriptionButton";

/**
 * Columns we read from public.profiles for the Account page. Source: PR #7
 * Stage 3 schema. RLS grants authenticated users SELECT on their own row.
 */
type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  is_founding_member: boolean | null;
};

const tierDisplayName: Record<Tier, string> = {
  anon: "",
  free: "Free",
  seed: "Seed",
  root: "Root",
  practitioner: "Practitioner",
};

const statusDisplayLabel: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  canceled: "Canceled",
  past_due: "Payment past due",
  incomplete: "Payment incomplete",
  incomplete_expired: "Payment expired",
  unpaid: "Unpaid",
  paused: "Paused",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Account / self-serve subscription management surface.
 *
 * Composition:
 *   - Header: display_name + email
 *   - Subscription card: current tier, status, renewal / cancel-at date,
 *     founding-member badge, and one of:
 *       · ManageSubscriptionButton (any user with a Stripe customer record)
 *       · "Choose a plan" CTA (users on the free tier with no prior subscription)
 *   - Sign-out row
 *
 * Gated by <RequireAuth> at the route level (App.tsx), so we can assume a
 * logged-in user is present on first render. We still defensively render a
 * skeleton while the profiles query is in-flight.
 *
 * Per Locked Decision §0.8 the canonical tier comes from current_user_tier()
 * (wrapped in useCurrentTier). Fields like subscription_status and
 * current_period_end are read directly from profiles for display only — they
 * are not authoritative for gating.
 */
export default function Account() {
  const { user, signOut } = useAuth();
  const { data: tier } = useCurrentTier();

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery<ProfileRow | null>({
    queryKey: ["profile", user?.id ?? "anon"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id, email, display_name, stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status, current_period_start, current_period_end, cancel_at_period_end, is_founding_member",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileRow | null;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  if (isLoading || !profile) return <PageSkeleton />;

  const hasStripeCustomer = !!profile.stripe_customer_id;
  const hasPaidTier =
    tier === "seed" || tier === "root" || tier === "practitioner";
  const displayName =
    profile.display_name ||
    user?.email?.split("@")[0] ||
    "Friend";
  const statusLabel = profile.subscription_status
    ? statusDisplayLabel[profile.subscription_status] ??
      profile.subscription_status
    : null;

  return (
    <section className="py-12 md:py-16 px-6">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Header */}
        <header className="space-y-3">
          <p
            className="font-accent text-xs tracking-[0.3em] uppercase"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Your Account
          </p>
          <h1
            className="font-serif text-3xl md:text-4xl font-bold"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Welcome back, {displayName}
          </h1>
          <p className="font-body text-muted-foreground">{user?.email}</p>
        </header>

        {isError && (
          <div
            className="rounded-lg border p-4 font-body text-sm"
            style={{
              borderColor: "hsl(var(--destructive) / 0.4)",
              backgroundColor: "hsl(var(--destructive) / 0.05)",
              color: "hsl(var(--destructive))",
            }}
          >
            We couldn't load your account details. Refresh the page, or
            contact us at hello@edeninstitute.health if this persists.
          </div>
        )}

        {/* Subscription card */}
        <section
          className="rounded-lg border p-6 space-y-5"
          style={{
            borderColor: "hsl(var(--border))",
            backgroundColor: "hsl(var(--eden-cream) / 0.3)",
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p
                className="font-accent text-xs tracking-[0.2em] uppercase mb-1"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Current Plan
              </p>
              <h2
                className="font-serif text-2xl font-semibold"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                {tier ? tierDisplayName[tier] || "Free" : "—"}
              </h2>
            </div>
            {profile.is_founding_member && (
              <span
                className="font-accent text-xs tracking-[0.2em] uppercase px-3 py-1 rounded-full border"
                style={{
                  color: "hsl(var(--eden-gold))",
                  borderColor: "hsl(var(--eden-gold))",
                }}
              >
                Founding Member
              </span>
            )}
          </div>

          {hasPaidTier && (
            <div
              className="space-y-3 pt-4 border-t"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                {statusLabel && (
                  <>
                    <dt className="font-body text-muted-foreground">
                      Status
                    </dt>
                    <dd className="font-body">{statusLabel}</dd>
                  </>
                )}
                <dt className="font-body text-muted-foreground">
                  {profile.cancel_at_period_end ? "Access ends" : "Renews"}
                </dt>
                <dd className="font-body">
                  {formatDate(profile.current_period_end)}
                </dd>
              </dl>
              {profile.cancel_at_period_end && (
                <p
                  className="font-body text-sm"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  Your subscription is scheduled to cancel at the end of the
                  current period. You can reactivate from the billing portal.
                </p>
              )}
              {profile.subscription_status === "past_due" && (
                <p
                  className="font-body text-sm"
                  style={{ color: "hsl(var(--destructive))" }}
                >
                  Your last payment didn't go through. Update your payment
                  method in the billing portal to keep your access.
                </p>
              )}
            </div>
          )}

          <div
            className="flex flex-col sm:flex-row gap-3 pt-4 border-t"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            {hasStripeCustomer && (
              <ManageSubscriptionButton />
            )}
            {!hasPaidTier && (
              <Button variant={hasStripeCustomer ? "eden-outline" : "eden"} asChild>
                <Link to="/apothecary/pricing">
                  {hasStripeCustomer ? "Choose a new plan" : "Choose a plan"}
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* Sign out */}
        <section
          className="pt-4 border-t"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <Button variant="eden-outline" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>
      </div>
    </section>
  );
}
