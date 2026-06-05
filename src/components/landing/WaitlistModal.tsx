import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { metaTrack } from "@/lib/metaPixel";
import { getMarketingConsent } from "@/lib/consent";
import { checkEmail } from "@/lib/emailTypos";

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audienceId: string;
  title: string;
  subtitle?: string;
  /**
   * Intent tag forwarded to the resend-waitlist EF as the `source` field.
   * Used for segmentation within a single Resend audience.
   * Examples: "reserve" | "sprouts_magnet" | "seedlings_magnet" | "waitlist".
   * Defaults to "waitlist" for backward compatibility with existing callers.
   */
  source?: string;
  /**
   * Explicit entry_funnel override, forwarded to the resend-waitlist EF.
   * Takes precedence over the legacy audienceId→funnel mapping there, so a
   * surface that shares an audienceId with another funnel (e.g. Community and
   * Eden's Table both use 'a48cb66e-…') can label its leads correctly.
   * Omit to let the EF resolve the funnel from audienceId/source.
   */
  funnel?: string;
  /**
   * Optional segmentation context (surface, Pattern, etc.) forwarded to the EF
   * as `metadata`. Persisted on waitlist_signups.metadata for later analysis.
   */
  metadata?: Record<string, unknown>;
}

const WaitlistModal = ({ open, onOpenChange, audienceId, title, subtitle, source = "waitlist", funnel, metadata }: WaitlistModalProps) => {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const acceptSuggestion = () => {
    if (emailSuggestion) {
      setEmail(emailSuggestion);
      setEmailSuggestion(null);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Guard against misspelled email domains (e.g. gmail.con) before we create
    // a Resend contact that can only ever hard-bounce.
    const check = checkEmail(email);
    if (check.invalid && check.suggestion) {
      setEmailSuggestion(check.suggestion);
      setError("That email address looks misspelled — please check it.");
      return;
    }

    setLoading(true);

    try {
      const fbEventId = crypto.randomUUID();
      const marketingConsent = getMarketingConsent() === "granted";
      const { data, error: fnError } = await supabase.functions.invoke("resend-waitlist", {
        body: {
          firstName,
          email,
          audienceId,
          source,
          fbEventId,
          marketingConsent,
          ...(funnel ? { entry_funnel: funnel } : {}),
          ...(metadata ? { metadata } : {}),
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      (window as any).gtag?.('event', 'email_submit', { event_category: 'conversion', event_label: source });
      metaTrack("Lead", { content_name: source, content_category: "waitlist" }, fbEventId);
      setSuccess(true);
      setFirstName("");
      setEmail("");
      setEmailSuggestion(null);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSuccess(false);
      setError("");
      setEmailSuggestion(null);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-foreground">{title}</DialogTitle>
          {subtitle && (<p className="font-body text-sm text-muted-foreground mt-2">{subtitle}</p>)}
        </DialogHeader>
        {success ? (
          <div className="py-8 text-center">
            <p className="font-accent text-lg text-foreground italic mb-2">You're on the list. We'll be in touch.</p>
            <p className="font-body text-xs text-muted-foreground/70 italic">Using Gmail? Your first email may arrive in your Promotions or Spam folder. Please move it to your Primary inbox so you don't miss anything from us.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div><label className="block font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">First Name</label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Your first name" required className="w-full px-4 py-3 bg-background border border-border font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-eden-gold transition-colors" /></div>
            <div>
              <label className="block font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailSuggestion(null); }}
                onBlur={() => setEmailSuggestion(checkEmail(email).suggestion)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 bg-background border border-border font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-eden-gold transition-colors"
              />
              {emailSuggestion && (
                <p className="font-body text-sm text-eden-gold mt-2">
                  Did you mean{" "}
                  <button type="button" onClick={acceptSuggestion} className="underline font-semibold">
                    {emailSuggestion}
                  </button>
                  ?
                </p>
              )}
            </div>
            {error && (<p className="font-body text-sm text-destructive">{error}</p>)}
            <Button variant="eden" size="xl" className="w-full" disabled={loading}>{loading ? "Submitting…" : "Connect With Us"}</Button>
            <p className="text-center font-body text-xs text-muted-foreground/60">No spam. Unsubscribe anytime.</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WaitlistModal;
