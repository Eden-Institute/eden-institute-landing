import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  lookupKey: string;
  children: React.ReactNode;
  variant?: "eden" | "eden-outline" | "eden-gold";
  size?: "default" | "sm" | "lg" | "xl";
  className?: string;
  disabled?: boolean;
  /**
   * Where to send the user if they are unauthenticated. Default redirects to
   * signup with a return_to that brings them back to the pricing page.
   */
  unauthRedirect?: string;
}

/**
 * Invokes the create-checkout Edge Function with the given Stripe lookup_key
 * (per Locked Decision §0.8: subscriptions are addressed by lookup_key, never
 * by hardcoded price ID). If the user is not authenticated, navigates them to
 * signup with a return_to so they come back to pricing after account creation.
 */
export function CheckoutButton({
  lookupKey,
  children,
  variant = "eden",
  size = "lg",
  className,
  disabled,
  unauthRedirect = "/apothecary/auth/signup?return_to=/apothecary/pricing",
}: Props) {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onClick = async () => {
    if (!user || !session) {
      navigate(unauthRedirect);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { lookup_key: lookupKey },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Checkout session missing redirect URL");
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start checkout";
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
      {submitting ? "Please wait…" : children}
    </Button>
  );
}
