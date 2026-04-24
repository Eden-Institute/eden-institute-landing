import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
      const msg =
        err instanceof Error ? err.message : "Could not open the billing portal";
      toast.error(msg);
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
