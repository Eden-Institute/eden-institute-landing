import { useState } from "react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// The customer-portal EF marks user-actionable failures with a `code` field
// (e.g. no_stripe_customer); everything else is a raw/technical string like
// "Edge Function returned a non-2xx status code" that a paying subscriber
// should never read. Surface only the coded, deliberately-authored messages.
async function friendlyPortalError(err: unknown): Promise<string> {
  const fallback =
    "Could not open the billing portal. Please try again or contact hello@edeninstitute.health.";
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      if (body?.code && typeof body.error === "string") return body.error;
    } catch {
      // Response body was not JSON; fall through to the friendly line.
    }
  }
  return fallback;
}

interface Props {
  /** Override the URL the portal returns to when user clicks "Return to Eden Institute". */
  returnUrl?: string;
  children?: React.ReactNode;
  variant?: "eden" | "eden-outline" | "eden-gold";
  size?: "default" | "sm" | "lg" | "xl";
  className?: string;
  disabled?: boolean;
}

/**
 * Opens the Stripe Customer Billing Portal for the current authenticated user.
 *
 * Invokes the `customer-portal` Edge Function, which:
 *   - verifies the JWT,
 *   - reads profiles.stripe_customer_id,
 *   - creates a short-lived `billing_portal.Session` via Stripe,
 *   - returns the session URL.
 *
 * Then redirects the browser (full-page navigation) to the portal URL. Plan
 * changes, cancellations, and payment method updates happen inside Stripe's
 * hosted UI and flow back via the existing stripe-webhook Edge Function
 * (race-safe per PR #9).
 *
 * This button is only meaningful for users who already have a
 * `stripe_customer_id`. Free-tier users with no Stripe customer should see
 * an Upgrade CTA instead; the Account page gates that.
 */
export function ManageSubscriptionButton({
  returnUrl,
  children = "Manage subscription",
  variant = "eden",
  size = "default",
  className,
  disabled,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const onClick = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "customer-portal",
        {
          body: returnUrl ? { return_url: returnUrl } : {},
        },
      );
      if (error) throw error;
      if (!data?.url) throw new Error("Portal session missing URL");
      window.location.href = data.url;
    } catch (err) {
      console.error("customer-portal failed:", err);
      toast.error(await friendlyPortalError(err));
      setSubmitting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={disabled || submitting}
    >
      {submitting ? "Opening portal…" : children}
    </Button>
  );
}
