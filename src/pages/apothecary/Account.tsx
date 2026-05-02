import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTier, Tier } from "@/hooks/useCurrentTier";
import { useTierAwareCTA } from "@/hooks/useTierAwareCTA";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";
import { ManageSubscriptionButton } from "@/components/apothecary/ManageSubscriptionButton";
import { JourneyCTA } from "@/components/journey/JourneyCTA";

/**
 * Columns we read from public.profiles for the Account page. Source: PR #7
 * Stage 3 schema. RLS grants authenticated users SELECT on their own row.
 *
 * v3.33.2: added constitution_type, populated by tg_quiz_completion_sync
 * trigger from quiz_completions on email match.
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
  constitution_type: string | null;
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

/**
 * Map raw constitution_type values to friendly Pattern names.
 * Accepts both shapes the EF allows:
 *   - slug shape: "frozen-knot"
 *   - name shape: "The Frozen Knot"
 *   - axis shape: "Cold / Damp / Tense"
 */
const CONSTITUTION_NICKNAMES: Record<string, string> = {
  "burning-bowstring": "The Burning Bowstring",
  "open-flame": "The Open Flame",
  "pressure-cooker": "The Pressure Cooker",
  "overflowing-cup": "The Overflowing Cup",
  "drawn-bowstring": "The Drawn Bowstring",
  "spent-candle": "The Spent Candle",
  "frozen-knot": "The Frozen Knot",
  "still-water": "The Still Water",
};

function prettyConstitution(raw: string | null): string | null {
  if (!raw) return null;
  const slug = raw.trim().toLowerCase();
  if (CONSTITUTION_NICKNAMES[slug]) return CONSTITUTION_NICKNAMES[slug];
  // If it already starts with "The ", treat as canonical name; else return verbatim.
  return raw.trim();
}

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
 * Composition (PR γ — 2026-05-02 update):
 *   - Header: display_name + email
 *   - **NEW (PR γ): JourneyCTA** — surfaces the dominant next step in
 *     the customer-journey state machine (Pattern quiz → $14 Deep-Dive
 *     Guide → Foundations Course → Seed → Root → Practitioner waitlist),
 *     mirroring the homepage placement shipped in PR β (commit 56cdddb).
 *     Same component, no prop wiring — JourneyCTA reads useTierAwareCTA
 *     internally and resolves the active person-profile's Pattern via
 *     the App-scoped ActiveProfileContext. The user sees the same
 *     one-step-at-a-time guidance whether they enter via / or directly
 *     into /apothecary/account.
 *   - Body Pattern card — surfaces the user's constitution result from
 *     the quiz, with a CTA to the directory and a state-aware guide
 *     CTA derived from useTierAwareCTA(). PR γ removes the no-Pattern
 *     branch's "Take the Pattern of Eden quiz" Button (a clean
 *     duplicate of JourneyCTA's quiz step); the no-Pattern branch is
 *     now purely descriptive and the dominant quiz action lives in
 *     JourneyCTA at the top of the page. The contextual guide CTA in
 *     the with-Pattern branch (PR #106 / 2026-04-30 state-aware
 *     restructure) is preserved — it anchors the visual Pattern →
 *     guide relationship within the Pattern card. The small italic
 *     "Retake the quiz" link is preserved (Lock #14: patterns shift
 *     over time).
 *   - Subscription card: current tier, status, renewal / cancel-at date,
 *     founding-member badge, and one of:
 *       · ManageSubscriptionButton (any user with a Stripe customer record)
 *       · "Choose a plan" CTA (users on the free tier with no prior subscription)
 *   - Sign-out row
 *
 * Gated by <RequireAuth> at the route level (App.tsx).
 *
 * Per Locked Decision §0.8 the canonical tier comes from current_user_tier()
 * (wrapped in useCurrentTier). Fields like subscription_status and
 * current_period_end are read directly from profiles for display only — they
 * are not authoritative for gating.
 */
export default function Account() {
  const { user, signOut } = useAuth();
  const { data: tier } = useCurrentTier();
  // State-aware guide CTA for the Body Pattern card's with-Pattern
  // branch. Same hook JourneyCTA uses internally, but here scoped to
  // the contextual Pattern → guide affordance (PR #106 / 2026-04-30
  // restructure). The dominant journey progression lives in
  // <JourneyCTA /> at the top of the page (PR γ).
  const { guide: guideCta } = useTierAwareCTA();

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
          "user_id, email, display_name, stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status, current_period_start, current_period_end, cancel_at_period_end, is_founding_member, constitution_type",
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
  const constitutionPretty = prettyConstitution(profile.constitution_type);

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
            We couldn&apos;t load your account details. Refresh the page, or
            contact us at hello@edeninstitute.health if this persists.
          </div>
        )}

        {/* PR γ (2026-05-02): dominant journey CTA at the top of the
            authed surface. Mirrors the homepage placement from PR β
            (commit 56cdddb) so the user sees the same one-step-at-a-time
            guidance whether they enter via / or directly into
            /apothecary/account. JourneyCTA is self-contained — it
            consumes useTierAwareCTA and the App-scoped
            ActiveProfileContext internally, so switching the active
            person-profile picker propagates here without prop wiring. */}
        <section aria-label="Your next step at Eden Institute">
          <JourneyCTA />
        </section>

        {/* Body Pattern card. Surfaces the user's quiz result so their
            account page reflects the work they've already done. Fixes
            Phase 5 #5 ("quiz responses didn't seem to register").

            2026-04-30 (tier-aware CTA propagation): the secondary CTA in
            the with-Pattern branch is the state-aware guide CTA from
            useTierAwareCTA(). A small text link below the buttons
            preserves the retake affordance — patterns can shift over
            time per the terrain framing (Lock #14).

            PR γ (2026-05-02): no-Pattern branch's "Take the Pattern of
            Eden quiz" Button removed (duplicated JourneyCTA's quiz
            step). Body copy preserved as descriptive context; the
            dominant action lives in JourneyCTA above. */}
        <section
          className="rounded-lg border p-6 space-y-4"
          style={{
            borderColor: "hsl(var(--border))",
            backgroundColor: "hsl(var(--eden-cream) / 0.3)",
          }}
        >
          <div>
            <p
              className="font-accent text-xs tracking-[0.2em] uppercase mb-1"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Your Body Pattern
            </p>
            {constitutionPretty ? (
              <>
                <h2
                  className="font-serif text-2xl font-semibold"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  {constitutionPretty}
                </h2>
                <p className="font-body text-sm text-muted-foreground mt-1">
                  Your body pattern (constitution) shapes how every herb works
                  for you. Your matched herbs are highlighted in the
                  Apothecary directory.
                </p>
              </>
            ) : (
              <>
                <h2
                  className="font-serif text-2xl font-semibold"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  Not yet known
                </h2>
                <p className="font-body text-sm text-muted-foreground mt-1">
                  Take the Pattern of Eden quiz to find your body pattern.
                  We&apos;ll highlight the herbs that meet your terrain across
                  the Apothecary.
                </p>
              </>
            )}
          </div>
          {/* PR γ: the contextual button row only renders in the
              with-Pattern branch. The no-Pattern branch's quiz Button
              was removed — JourneyCTA at the top of the page is the
              dominant quiz action. */}
          {constitutionPretty && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="eden" asChild>
                <Link to={ROUTES.APOTHECARY}>View matched herbs</Link>
              </Button>
              {/* State-aware guide CTA (PR #106 / 2026-04-30). Surfaces
                  the user's (Pattern, guide-purchased) state machine via
                  useTierAwareCTA(). Anchors the visual Pattern → guide
                  relationship within the Pattern card; the dominant
                  cross-page journey CTA lives in <JourneyCTA /> above. */}
              <Button variant="eden-outline" asChild>
                <Link to={guideCta.href}>{guideCta.label}</Link>
              </Button>
            </div>
          )}
          {/* De-prioritized retake affordance. Patterns can shift over time
              (terrain framing, Lock #14), so we preserve the retake path —
              but as a small text link rather than a primary button. Only
              rendered when the user already has a Pattern; the no-Pattern
              branch's primary action lives in JourneyCTA at the top. */}
          {constitutionPretty && (
            <p className="font-body text-xs italic text-muted-foreground pt-1">
              Patterns shift over time.{" "}
              <Link
                to={ROUTES.ASSESSMENT}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Retake the quiz →
              </Link>
            </p>
          )}
        </section>

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
                  Your last payment didn&apos;t go through. Update your payment
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
                <Link to={ROUTES.APOTHECARY_PRICING}>
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
