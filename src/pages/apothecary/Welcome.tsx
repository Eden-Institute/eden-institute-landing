import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTier, Tier } from "@/hooks/useCurrentTier";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";

type Status = "verifying" | "confirmed" | "not_paid" | "missing_session" | "error";

const tierDisplayName: Record<Tier, string> = {
  anon: "",
  free: "Free",
  seed: "Seed",
  root: "Root",
  practitioner: "Practitioner",
};

/**
 * Post-checkout landing. Reads ?session_id= from the query string (Stripe
 * substitutes {CHECKOUT_SESSION_ID} on redirect), validates the payment went
 * through via verify-session Edge Function, then waits for the webhook to
 * reconcile profiles.subscription_tier before rendering confirmation.
 *
 * Webhook reconciliation is usually near-instant but there is a natural race
 * on the success redirect. useCurrentTier polling handles that via short
 * refetchInterval while tier is still 'free'.
 *
 * Closes launch-blocker #51.
 */
export default function Welcome() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const { user, loading: authLoading } = useAuth();
  const { data: currentTier, refetch: refetchTier } = useCurrentTier();
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

  // Step 2: watch tier; if it flips to a paid tier, mark confirmed. Poll up to
  // ~10 seconds if still on free (covers webhook race).
  useEffect(() => {
    if (status === "missing_session" || status === "not_paid" || status === "error") {
      return;
    }
    if (currentTier && currentTier !== "anon" && currentTier !== "free") {
      setStatus("confirmed");
      return;
    }
    if (polls >= 6) {
      // Gave up polling — show confirmed but flag that tier may still be propagating
      setStatus("confirmed");
      return;
    }
    const t = setTimeout(() => {
      refetchTier();
      setPolls((p) => p + 1);
    }, 1500);
    return () => clearTimeout(t);
  }, [currentTier, polls, status, refetchTier]);

  if (authLoading) return <PageSkeleton />;

  if (!user) {
    // A rare edge case: not signed in but hit /welcome. Redirect to signin.
    navigate("/apothecary/auth/signin", { replace: true });
    return null;
  }

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
              Give us a moment — we're verifying the payment with Stripe and
              unlocking your access.
            </p>
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
              You're on the{" "}
              {currentTier && currentTier !== "anon" && currentTier !== "free"
                ? tierDisplayName[currentTier]
                : "paid"}{" "}
              plan.
            </h1>
            <p className="font-body text-muted-foreground">
              {currentTier === "free" || currentTier === "anon"
                ? "Your subscription is processing. The upgrade will appear in a moment — you can already start exploring."
                : "Thank you for stewarding this work. The full clinical library is now open to you."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button variant="eden" size="lg" asChild>
                <Link to="/apothecary">Go to Apothecary home</Link>
              </Button>
              <Button variant="eden-outline" size="lg" asChild>
                <Link to="/apothecary/pricing">View plan details</Link>
              </Button>
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
              <Link to="/apothecary/pricing">Back to pricing</Link>
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
              <Link to="/apothecary">Go to Apothecary home</Link>
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
                "Something went wrong on our side. Your payment may still have processed — check your email for a Stripe receipt, or contact us at hello@edeninstitute.health."}
            </p>
            <Button variant="eden" size="lg" asChild>
              <Link to="/apothecary">Back to Apothecary home</Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
