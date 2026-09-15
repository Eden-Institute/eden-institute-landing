import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTier, Tier } from "@/hooks/useCurrentTier";
import { ROUTES } from "@/lib/routes";
import { readCheckoutSessionId } from "@/lib/checkoutSession";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";

type Status = "verifying" | "processing" | "confirmed" | "not_paid" | "missing_session" | "error";

// Tier polling after Stripe's success redirect. The webhook usually lands within a
// couple of seconds, so the first polls are quick. After FAST_POLLS without the
// tier flipping the page stops pretending and shows "processing" (founder decision
// 2026-09-15: it used to say "You're on the paid plan." while the tier was still
// free), then keeps checking gently in the background for about two minutes.
const FAST_POLLS = 6;
const FAST_POLL_MS = 1500;
const SLOW_POLL_MS = 5000;
const SLOW_POLLS = 24;

const isPaidTier = (t: Tier | undefined): boolean => !!t && t !== "anon" && t !== "free";

const tierDisplayName: Record<Tier, string> = {
  anon: "",
  free: "Free",
  seed: "Seed",
  root: "Root",
  practitioner: "Practitioner",
};

/**
 * Post-checkout landing. Reads the ?session_id= Stripe substitutes for
 * {CHECKOUT_SESSION_ID} on redirect (via readCheckoutSessionId, since index.html
 * moves it out of the URL before any tag loads), validates the payment went
 * through via verify-session Edge Function, then waits for the webhook to
 * reconcile profiles.subscription_tier before rendering confirmation.
 *
 * Webhook reconciliation is usually near-instant but there is a natural race
 * on the success redirect. The page polls useCurrentTier: quickly at first, then,
 * if the tier has still not flipped, it shows a "processing" state with a
 * "Check again" button and keeps polling every few seconds for about two minutes,
 * switching to the confirmed welcome by itself when the tier lands.
 *
 * Closes launch-blocker #51.
 *
 * Rendered only inside RequireAuth (App.tsx), so a signed-out visitor never
 * reaches this component.
 */
export default function Welcome() {
  // index.html's first script has already moved session_id out of the URL
  // (src/lib/checkoutSession.ts).
  const sessionId = readCheckoutSessionId();
  const { loading: authLoading } = useAuth();
  const { data: currentTier, refetch: refetchTier, isFetching: tierFetching } = useCurrentTier();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  // Step 1: validate session_id via verify-session, then invalidate tier cache
  useEffect(() => {
    if (authLoading) return;

    if (!sessionId) {
      setStatus("missing_session");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "verify-session",
          { body: { session_id: sessionId } },
        );
        if (cancelled) return;
        if (error) throw error;
        if (!data?.paid) {
          setStatus("not_paid");
          return;
        }
        // Paid — invalidate tier cache and start polling below
        await queryClient.invalidateQueries({ queryKey: ["currentTier"] });
        refetchTier();
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Could not verify session",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, authLoading, queryClient, refetchTier]);

  // Step 2: watch tier; if it flips to a paid tier, mark confirmed. Poll quickly
  // for ~9 seconds, then show "processing" and keep polling every 5 seconds for
  // about two more minutes. "Check again" refetches on demand at any point.
  useEffect(() => {
    if (status === "missing_session" || status === "not_paid" || status === "error") {
      return;
    }
    if (isPaidTier(currentTier)) {
      if (status !== "confirmed") setStatus("confirmed");
      return;
    }
    if (status === "confirmed") return;
    if (status === "verifying" && polls >= FAST_POLLS) {
      setStatus("processing");
      return;
    }
    if (polls >= FAST_POLLS + SLOW_POLLS) return; // background polling done
    const t = setTimeout(() => {
      refetchTier();
      setPolls((p) => p + 1);
    }, polls < FAST_POLLS ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => clearTimeout(t);
  }, [currentTier, polls, status, refetchTier]);

  if (authLoading) return <PageSkeleton />;

  return (
    <section className="min-h-[70vh] flex items-center justify-center py-16 px-6">
      <div className="max-w-xl w-full text-center space-y-6">
        {status === "verifying" && (
          <>
            <Loader2
              className="w-10 h-10 mx-auto animate-spin"
              style={{ color: "hsl(var(--eden-gold))" }}
            />
            <h1
              className="font-serif text-3xl md:text-4xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Confirming your subscription…
            </h1>
            <p className="font-body text-muted-foreground">
              Give us a moment. We're verifying the payment with Stripe and
              opening the full library to you.
            </p>
          </>
        )}

        {status === "processing" && (
          <>
            <CheckCircle2
              className="w-12 h-12 mx-auto"
              style={{ color: "hsl(var(--eden-gold))" }}
            />
            <h1
              className="font-serif text-3xl md:text-4xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Payment received. Your upgrade is on its way.
            </h1>
            <p className="font-body text-muted-foreground">
              Stripe has confirmed your payment and we are finishing the setup on
              our side. This usually takes under a minute. If your plan still has
              not updated in a few minutes, email hello@edeninstitute.health and
              we will sort it out.
            </p>
            <div className="flex justify-center pt-2">
              <Button
                variant="eden"
                size="lg"
                onClick={() => refetchTier()}
                disabled={tierFetching}
              >
                {tierFetching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Check again
              </Button>
            </div>
          </>
        )}

        {status === "confirmed" && (
          <>
            <CheckCircle2
              className="w-12 h-12 mx-auto"
              style={{ color: "hsl(var(--eden-gold))" }}
            />
            <p
              className="font-accent text-sm tracking-[0.3em] uppercase"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Welcome to Eden Apothecary
            </p>
            <h1
              className="font-serif text-3xl md:text-4xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              You're on the {tierDisplayName[currentTier]} plan.
            </h1>
            <p className="font-body text-muted-foreground">
              Thank you for stewarding this work. The full clinical library is now open to you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              {currentTier === "practitioner" ? (
                <>
                  {/* The Clinic is the flagship surface a practitioner just
                      bought, so it leads on the confirmation screen. */}
                  <Button variant="eden" size="lg" asChild>
                    <Link to={ROUTES.PRACTITIONER_CLINIC}>Open the Clinic</Link>
                  </Button>
                  <Button variant="eden-outline" size="lg" asChild>
                    <Link to={ROUTES.APOTHECARY}>Go to Apothecary home</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="eden" size="lg" asChild>
                    <Link to={ROUTES.APOTHECARY}>Go to Apothecary home</Link>
                  </Button>
                  <Button variant="eden-outline" size="lg" asChild>
                    <Link to={ROUTES.APOTHECARY_PRICING}>View plan details</Link>
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        {status === "not_paid" && (
          <>
            <AlertTriangle
              className="w-10 h-10 mx-auto"
              style={{ color: "hsl(var(--eden-gold))" }}
            />
            <h1
              className="font-serif text-3xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Payment not completed
            </h1>
            <p className="font-body text-muted-foreground">
              The checkout session didn't complete. You haven't been charged.
              You can try again from the pricing page.
            </p>
            <Button variant="eden" size="lg" asChild>
              <Link to={ROUTES.APOTHECARY_PRICING}>Back to pricing</Link>
            </Button>
          </>
        )}

        {status === "missing_session" && (
          <>
            <AlertTriangle
              className="w-10 h-10 mx-auto"
              style={{ color: "hsl(var(--eden-gold))" }}
            />
            <h1
              className="font-serif text-3xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              No session to confirm
            </h1>
            <p className="font-body text-muted-foreground">
              This page is the landing after completing a checkout. If you got
              here another way, head back to the Apothecary home.
            </p>
            <Button variant="eden" size="lg" asChild>
              <Link to={ROUTES.APOTHECARY}>Go to Apothecary home</Link>
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <AlertTriangle
              className="w-10 h-10 mx-auto"
              style={{ color: "hsl(var(--eden-gold))" }}
            />
            <h1
              className="font-serif text-3xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              We couldn't confirm your subscription
            </h1>
            <p className="font-body text-muted-foreground">
              {errorMessage ??
                "Something went wrong on our side. Your payment may still have processed. Check your email for a Stripe receipt, or contact us at hello@edeninstitute.health."}
            </p>
            <Button variant="eden" size="lg" asChild>
              <Link to={ROUTES.APOTHECARY}>Back to Apothecary home</Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
