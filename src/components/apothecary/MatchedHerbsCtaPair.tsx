import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { EdenPatternName } from "@/lib/edenPattern";
import { getAmazonKitUrl } from "@/lib/amazonKitUrls";
import { ROUTES } from "@/lib/routes";
import type { Tier } from "@/hooks/useCurrentTier";

/**
 * §8.1.4 PR 4 — Matched-Herbs CTA Pair (bottom of the matched-herbs
 * directory on /apothecary).
 *
 * Two cards, side-by-side on md+, stacked on mobile:
 *   1. Practitioner tier — launched-state pitch (founding rate) pointing at
 *      the pricing card. The tier went live 2026-07-09.
 *   2. Pattern-aligned Amazon affiliate kit (link) — a beginner on-ramp.
 *
 * Suppression rules:
 *   • activePattern null → component returns null (no Pattern context to
 *     anchor the Amazon card).
 *   • tier "practitioner" → component returns null. The top tier already
 *     owns the Practitioner tier and gets no tier-promo or beginner on-ramp.
 *   • Amazon URL missing for Pattern → suppress that card only; render the
 *     Practitioner card alone.
 *
 * The PractitionerInfoCard root div carries id="practitioner-tier" as a
 * scroll anchor for deep-links via the global ScrollToTop hook.
 */

interface MatchedHerbsCtaPairProps {
  activePattern: EdenPatternName | null;
  tier?: Tier;
}

export function MatchedHerbsCtaPair({
  activePattern,
  tier,
}: MatchedHerbsCtaPairProps) {
  if (!activePattern) return null;
  if (tier === "practitioner") return null;

  const amazonUrl = getAmazonKitUrl(activePattern);

  return (
    <section
      aria-label="Continuing the practice"
      className="grid gap-6 md:grid-cols-2"
    >
      <PractitionerInfoCard />
      {amazonUrl && (
        <AmazonKitCard activePattern={activePattern} amazonUrl={amazonUrl} />
      )}
    </section>
  );
}

// ── Card 1: Practitioner tier (launched) ─────────────────────────────

function PractitionerInfoCard() {
  return (
    <div
      id="practitioner-tier"
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
        Practitioner tier · now open
      </p>
      <h2
        className="font-serif text-xl md:text-2xl font-semibold leading-tight mb-3 break-words"
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        The clinical practice tier is here.
      </h2>
      <p className="font-body text-sm text-muted-foreground mb-5 break-words">
        Formula builder, dose schedules, exportable case files, and the full
        contraindication apparatus, for clinicians and serious practitioners.
      </p>
      <p className="font-body text-sm text-foreground leading-relaxed mb-5 break-words">
        <strong>Founding practitioners lock the launch rate for life.</strong>
      </p>
      <Button
        variant="eden-outline"
        size="lg"
        className="w-full min-h-11 h-auto whitespace-normal text-sm leading-tight py-2 px-3 text-center mt-auto"
        asChild
      >
        <Link to={`${ROUTES.APOTHECARY_PRICING}#tier-practitioner`}>
          See the Practitioner tier
        </Link>
      </Button>
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
        Herbs aligned to your Pattern so you can begin practicing: teas,
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
        Affiliate links: Eden Institute earns a small commission if you
        purchase through them, at no extra cost to you.
      </p>
    </div>
  );
}

export default MatchedHerbsCtaPair;
