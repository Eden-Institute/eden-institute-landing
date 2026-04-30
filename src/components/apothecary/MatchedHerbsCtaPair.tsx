import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { EdenPatternName } from "@/lib/edenPattern";
import {
  getAmazonKitUrl,
  patternNameToSlug,
} from "@/lib/amazonKitUrls";

/**
 * §8.1.4 PR 4 — Matched-Herbs CTA Pair.
 *
 * Replaces the §8.1.5 formulary slot at the bottom of the matched-herbs
 * directory on /apothecary, after the binding decision (2026-04-29) that
 * formularies are Practitioner-tier-only and deferred from pre-launch.
 *
 * Two cards, side-by-side on md+, stacked on mobile:
 *   1. Practitioner Waitlist signup (form → practitioner-waitlist-signup EF)
 *   2. Pattern-aligned Amazon affiliate kit (link)
 *
 * Suppression rules:
 *   • activePattern null → component returns null (no Pattern context to
 *     anchor either card).
 *   • Amazon URL missing for Pattern → suppress that card only; render
 *     Practitioner card alone (defensive — should never happen for the 8).
 *
 * Mobile behaviour:
 *   • md:grid-cols-2 → single column on small screens, side-by-side on md+.
 *   • Card divs carry `min-w-0` so grid children respect the track width
 *     instead of overflowing to their intrinsic content width.
 *   • Buttons use `min-h-11 h-auto whitespace-normal` so long CTA labels
 *     wrap on phones rather than pushing past the card edge. Tap-target
 *     rule (≥44px) preserved via min-h-11.
 *   • h2 + body p use `break-words` defensively for long Pattern names
 *     that get interpolated into the heading.
 *
 * Hash-anchor scroll target:
 *   The PractitionerWaitlistCard root div carries id="practitioner-
 *   waitlist" so the hamburger menu's tier-aware Root upgrade CTA can
 *   navigate to /apothecary#practitioner-waitlist and the global
 *   ScrollToTop hook (PR #92) scrolls the form into view.
 */

interface MatchedHerbsCtaPairProps {
  activePattern: EdenPatternName | null;
}

export function MatchedHerbsCtaPair({
  activePattern,
}: MatchedHerbsCtaPairProps) {
  const { user } = useAuth();
  if (!activePattern) return null;

  const amazonUrl = getAmazonKitUrl(activePattern);
  const patternSlug = patternNameToSlug(activePattern);

  return (
    <section
      aria-label="Continuing the practice"
      className="grid gap-6 md:grid-cols-2"
    >
      <PractitionerWaitlistCard
        activePattern={activePattern}
        patternSlug={patternSlug}
        defaultEmail={user?.email ?? ""}
      />
      {amazonUrl && (
        <AmazonKitCard activePattern={activePattern} amazonUrl={amazonUrl} />
      )}
    </section>
  );
}

// ── Card 1: Practitioner Waitlist ─────────────────────────────────────

interface PractitionerWaitlistCardProps {
  activePattern: EdenPatternName;
  patternSlug: string;
  defaultEmail: string;
}

function PractitionerWaitlistCard({
  activePattern,
  patternSlug,
  defaultEmail,
}: PractitionerWaitlistCardProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting" || status === "success") return;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "practitioner-waitlist-signup",
        {
          body: {
            email: email.trim(),
            first_name: firstName.trim() || undefined,
            pattern_slug: patternSlug,
            pattern_name: activePattern,
            source_url:
              typeof window !== "undefined" ? window.location.href : undefined,
          },
        },
      );
      if (error) throw error;
      if (!data?.ok) {
        throw new Error(
          (data as { error?: string } | null)?.error ?? "Could not record signup",
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

  return (
    <div
      id="practitioner-waitlist"
      className="rounded-lg border p-6 md:p-8 flex flex-col min-w-0 scroll-mt-20"
      style={{
        borderColor: "hsl(var(--eden-gold) / 0.4)",
        backgroundColor: "hsl(var(--eden-cream) / 0.5)",
      }}
    >
      <p
        className="font-accent text-[11px] tracking-[0.3em] uppercase mb-2 break-words"
        style={{ color: "hsl(var(--eden-gold))" }}
      >
        Practitioner tier — opens end of 2027
      </p>
      <h2
        className="font-serif text-xl md:text-2xl font-semibold leading-tight mb-3 break-words"
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        Tell me when the clinical practice tier opens.
      </h2>
      <p className="font-body text-sm text-muted-foreground mb-5 break-words">
        Formula builder, dose schedules, exportable case files, and the full
        contraindication apparatus — for clinicians and serious practitioners.
        Be first in line.
      </p>

      {status === "success" ? (
        <div
          className="rounded-md border p-4 mt-auto"
          style={{
            borderColor: "hsl(var(--eden-gold) / 0.5)",
            backgroundColor: "hsl(var(--eden-cream) / 0.7)",
          }}
        >
          <p
            className="font-serif text-base font-semibold mb-1"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            You're on the list.
          </p>
          <p className="font-body text-sm text-muted-foreground">
            We'll email you when Practitioner-tier opens for enrollment.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 mt-auto" noValidate>
          <div>
            <Label htmlFor="practitioner-waitlist-email" className="sr-only">
              Email
            </Label>
            <Input
              id="practitioner-waitlist-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11"
              disabled={status === "submitting"}
            />
          </div>
          <div>
            <Label htmlFor="practitioner-waitlist-name" className="sr-only">
              First name (optional)
            </Label>
            <Input
              id="practitioner-waitlist-name"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name (optional)"
              className="h-11"
              disabled={status === "submitting"}
            />
          </div>
          <Button
            type="submit"
            variant="eden"
            size="lg"
            className="w-full min-h-11 h-auto whitespace-normal text-sm leading-tight py-2 px-3 text-center"
            disabled={status === "submitting"}
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
                Adding you to the list…
              </>
            ) : (
              "Add me to the Practitioner waitlist"
            )}
          </Button>
          {status === "error" && errorMessage && (
            <p
              className="font-body text-sm break-words"
              style={{ color: "hsl(var(--destructive))" }}
            >
              {errorMessage}. Please try again or email
              hello@edeninstitute.health.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

// ── Card 2: Amazon Kit ─────────────────────────────────────────────

interface AmazonKitCardProps {
  activePattern: EdenPatternName;
  amazonUrl: string;
}

function AmazonKitCard({ activePattern, amazonUrl }: AmazonKitCardProps) {
  const patternShort = activePattern.replace(/^The\s+/i, "");
  return (
    <div
      className="rounded-lg border p-6 md:p-8 flex flex-col min-w-0"
      style={{
        borderColor: "hsl(var(--border))",
        backgroundColor: "hsl(var(--eden-cream) / 0.3)",
      }}
    >
      <p
        className="font-accent text-[11px] tracking-[0.3em] uppercase mb-2 break-words"
        style={{ color: "hsl(var(--eden-gold))" }}
      >
        Begin in your own kitchen
      </p>
      <h2
        className="font-serif text-xl md:text-2xl font-semibold leading-tight mb-3 break-words"
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        A starter set on Amazon for {patternShort}.
      </h2>
      <p className="font-body text-sm text-muted-foreground mb-5 break-words">
        Herbs aligned to your pattern so you can begin practicing — teas,
        tinctures, dry herb. We curated the kit; preparation and use are yours
        to learn through the Apothecary.
      </p>
      <Button
        variant="eden-outline"
        size="lg"
        className="w-full min-h-11 h-auto whitespace-normal text-sm leading-tight py-2 px-3 text-center mt-auto"
        asChild
      >
        <a
          href={amazonUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          aria-label={`Open the Amazon starter set for ${patternShort} in a new tab`}
        >
          <span className="break-words">
            See the {patternShort} starter set
          </span>
          <ExternalLink className="w-4 h-4 ml-2 shrink-0" aria-hidden="true" />
        </a>
      </Button>
      <p
        className="font-body text-xs mt-3 italic break-words"
        style={{ color: "hsl(var(--muted-foreground))" }}
      >
        Affiliate links — Eden Institute earns a small commission if you
        purchase through them, at no extra cost to you.
      </p>
    </div>
  );
}

export default MatchedHerbsCtaPair;
