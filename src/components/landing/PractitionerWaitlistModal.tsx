import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { supabase } from "@/integrations/supabase/client";
import { patternNameToSlug } from "@/lib/amazonKitUrls";

interface PractitionerWaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Surface tag, written into post-launch Leads Intelligence segmentation
   * so we can distinguish modal opens (this component, surfaced from
   * JourneyCTA / Navbar / etc.) from the inline matched-herbs form
   * submissions on /apothecary. Defaults to a generic value; callers
   * should pass a more specific surface where it adds analytic value.
   */
  surface?: string;
}

/**
 * PR ι (iota) — modal wrapper around the practitioner-waitlist-signup
 * Edge Function. Mirrors the exact body shape used by the inline form
 * on /apothecary's matched-herbs surface (PractitionerWaitlistCard
 * inside MatchedHerbsCtaPair) so any surface that previously routed to
 * /apothecary#practitioner-waitlist (a structural 2-click flow:
 * Link → page nav → scroll past the full herb directory → reach the
 * inline form → submit) can now open this modal directly. That
 * collapses the conversion surface to 1 click — the same pattern PR η
 * shipped for the Tier 2 + Eden's Table homepage cards.
 *
 * The MatchedHerbsCtaPair inline form is INTENTIONALLY left in place.
 * That surface pairs the Practitioner waitlist with the Pattern-aligned
 * Amazon affiliate kit (worldview-specific dual-CTA per Camila's PR ι
 * spec; explicitly exempt). Visitors who land on /apothecary directly,
 * scroll the directory, and submit the inline form keep that path.
 * This modal is for every OTHER surface that previously routed users
 * INTO that page just to find the form.
 *
 * EF contract is unchanged — practitioner-waitlist-signup accepts:
 *   { email, first_name?, pattern_slug?, pattern_name?, source_url?,
 *     surface? }
 *
 * pattern_slug + pattern_name are derived from the active person
 * profile via useEdenPattern when present. Anonymous visitors and
 * users with an unresolved Pattern submit without those fields — the
 * EF accepts a Pattern-less submission and the row is tagged generic
 * Practitioner waitlist.
 *
 * Validation, submission flow, and success/error handling intentionally
 * mirror the inline card so behaviour is identical across both surfaces
 * (don't change waitlist-form behaviour, per PR ι spec).
 */
export function PractitionerWaitlistModal({
  open,
  onOpenChange,
  surface = "practitioner_waitlist_modal",
}: PractitionerWaitlistModalProps) {
  const { user } = useAuth();
  const { data: activePattern } = useEdenPattern();

  const [email, setEmail] = useState(user?.email ?? "");
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If the auth state resolves AFTER initial mount (the common case for
  // first-render-then-hydrate), keep the email field in sync so the
  // signed-in user doesn't have to retype their address. Skipped once
  // the user has typed something into the field.
  useEffect(() => {
    if (status === "idle" && user?.email && email === "") {
      setEmail(user.email);
    }
  }, [user?.email, status, email]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting" || status === "success") return;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const body: Record<string, unknown> = {
        email: email.trim(),
        surface,
      };
      const trimmedName = firstName.trim();
      if (trimmedName) body.first_name = trimmedName;
      if (activePattern) {
        body.pattern_name = activePattern;
        body.pattern_slug = patternNameToSlug(activePattern);
      }
      if (typeof window !== "undefined") {
        body.source_url = window.location.href;
      }

      const { data, error } = await supabase.functions.invoke(
        "practitioner-waitlist-signup",
        { body },
      );
      if (error) throw error;
      if (!data?.ok) {
        throw new Error(
          (data as { error?: string } | null)?.error ??
            "Could not record signup",
        );
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Could not record signup",
      );
    }
  }

  function handleClose(next: boolean) {
    if (!next) {
      // Reset transient form state on close so reopening starts clean.
      // We DON'T reset success state visibly — the user already saw it
      // — we just clear it for the next open.
      setStatus("idle");
      setErrorMessage(null);
      setFirstName("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-foreground">
            Join the Practitioner Waitlist
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground pt-2">
            Formula builder, dose schedules, exportable case files, and the
            full contraindication apparatus — for clinicians and serious
            practitioners. Be first in line when the Practitioner tier
            opens.
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div className="py-8 text-center">
            <p className="font-accent text-lg text-foreground italic mb-2">
              You're on the list.
            </p>
            <p className="font-body text-sm text-muted-foreground">
              We'll email you when the Practitioner tier opens for
              enrollment.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
            <div>
              <Label
                htmlFor="practitioner-waitlist-modal-email"
                className="font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2 block"
              >
                Email
              </Label>
              <Input
                id="practitioner-waitlist-modal-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                // PR κ: strip ALL whitespace (incl. internal spaces some
                // mobile autocomplete engines insert between '@' and the
                // domain) and lowercase. Defensive frontend layer; the
                // EF normalizes on its end too.
                onChange={(e) => setEmail(e.target.value.replace(/\s+/g, "").toLowerCase().trim())}
                placeholder="you@example.com"
                disabled={status === "submitting"}
              />
            </div>
            <div>
              <Label
                htmlFor="practitioner-waitlist-modal-name"
                className="font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2 block"
              >
                First Name (optional)
              </Label>
              <Input
                id="practitioner-waitlist-modal-name"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                disabled={status === "submitting"}
              />
            </div>
            {status === "error" && errorMessage && (
              <p
                className="font-body text-sm"
                style={{ color: "hsl(var(--destructive))" }}
                role="alert"
              >
                {errorMessage}. Please try again or email
                hello@edeninstitute.health.
              </p>
            )}
            <Button
              type="submit"
              variant="eden"
              size="xl"
              className="w-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] h-auto py-3"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
                  Adding you to the list…
                </>
              ) : (
                "Reserve My Founding Spot"
              )}
            </Button>
            <p className="text-center font-body text-xs text-muted-foreground/60">
              No spam. Unsubscribe anytime.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PractitionerWaitlistModal;
