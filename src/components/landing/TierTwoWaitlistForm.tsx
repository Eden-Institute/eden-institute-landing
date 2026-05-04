import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

const signupSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(100, { message: "First name must be less than 100 characters" }),
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
});

interface TierTwoWaitlistFormProps {
  /**
   * Optional surface tag, written into analytics on submit so the
   * post-launch Leads Intelligence dashboard can distinguish a homepage
   * modal submit from a /tier-2-waitlist page submit. Defaults to
   * 'tier_two_waitlist_page'.
   */
  surface?: string;
  /**
   * Variant: "card" renders the form on the standalone /tier-2-waitlist
   * page (own border + heading), "modal" renders without border or
   * heading because the parent Dialog provides those. Default: "card".
   */
  variant?: "card" | "modal";
}

/**
 * PR η fix #2 — Tier 2 waitlist form, extracted from /tier-2-waitlist
 * page so it can be embedded in a homepage modal as well. Single source
 * of truth for the tier-2-waitlist-signup EF call so we don't drift
 * client copies of the body shape.
 *
 * Calls the dedicated tier-2-waitlist-signup Edge Function (NOT the
 * generic resend-waitlist EF) — Tier 2 has its own audience taxonomy
 * and the EF was hot-fixed in v18 (Prefer header reduced to
 * return=minimal) just before launch. Frontend doesn't touch the EF
 * here.
 */
export function TierTwoWaitlistForm({
  surface = "tier_two_waitlist_page",
  variant = "card",
}: TierTwoWaitlistFormProps) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = signupSchema.safeParse({ firstName, email });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Please check your inputs");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("tier-2-waitlist-signup", {
        body: {
          firstName: parsed.data.firstName,
          email: parsed.data.email,
          // PR η: pass surface for post-launch analytics. The EF will
          // ignore unknown fields, but downstream EF version-bump can
          // start writing this into the row's metadata column when
          // Camila wants it.
          surface,
          source_url:
            typeof window !== "undefined" ? window.location.pathname : undefined,
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      try {
        (window as any).gtag?.("event", "tier_2_waitlist_signup", {
          event_category: "lead",
          event_label: surface,
        });
      } catch {
        /* noop */
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Tier 2 waitlist signup failed:", err);
      setError("Something went wrong. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className={
          variant === "card"
            ? "rounded-lg p-10 bg-background border-2 text-center"
            : "p-2 text-center"
        }
        style={variant === "card" ? { borderColor: "hsl(var(--eden-gold))" } : undefined}
      >
        <div className="flex justify-center mb-4">
          <CheckCircle2
            className="w-12 h-12"
            style={{ color: "hsl(var(--eden-gold))" }}
            aria-hidden="true"
          />
        </div>
        <h3
          className="font-serif text-2xl font-bold mb-3"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          You're on the list.
        </h3>
        <div
          className="w-12 h-px mx-auto mb-5"
          style={{ backgroundColor: "hsl(var(--eden-gold))" }}
        />
        <p className="font-body text-sm leading-relaxed text-muted-foreground">
          We'll email your founding access code the moment Tier 2 opens.
        </p>
        <p className="font-body text-sm leading-relaxed text-muted-foreground mt-3">
          In the meantime, check your inbox — your confirmation is on its way.{" "}
          <strong style={{ color: "hsl(var(--eden-bark))" }}>Using Gmail?</strong> Your first email may
          arrive in Promotions or Spam — please move it to your Primary inbox so you don't miss your
          founding code.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        variant === "card"
          ? "rounded-lg p-8 bg-background border space-y-5"
          : "space-y-5"
      }
      style={variant === "card" ? { borderColor: "hsl(var(--eden-gold) / 0.4)" } : undefined}
    >
      <div>
        <Label htmlFor="t2-firstName" className="font-body text-sm mb-2 block">
          First Name
        </Label>
        <Input
          id="t2-firstName"
          name="firstName"
          type="text"
          required
          autoComplete="given-name"
          maxLength={100}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Your first name"
          disabled={submitting}
        />
      </div>
      <div>
        <Label htmlFor="t2-email" className="font-body text-sm mb-2 block">
          Email
        </Label>
        <Input
          id="t2-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={255}
          value={email}
          // PR κ: strip ALL whitespace (incl. internal spaces some
          // mobile autocomplete engines insert between '@' and the
          // domain) and lowercase before HTML5 + zod validation.
          onChange={(e) => setEmail(e.target.value.replace(/\s+/g, "").toLowerCase().trim())}
          placeholder="you@example.com"
          disabled={submitting}
        />
      </div>
      {error && (
        <p className="font-body text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="eden"
        size="xl"
        className="w-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] h-auto py-3"
        disabled={submitting}
      >
        {submitting ? "Reserving Your Spot…" : "Reserve My Founding Access"}
      </Button>
      <p className="font-body text-xs text-center text-muted-foreground">
        Free. No payment. Unsubscribe anytime.
      </p>
    </form>
  );
}

export default TierTwoWaitlistForm;
