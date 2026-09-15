import { Button } from "@/components/ui/button";

// Goes through api/go/course.ts so the click is counted (course sells
// off-site on LearnWorlds; this is the only way to see if the CTA works).
const TIER_1_URL = "/go/course?src=tier2";

interface TierTwoWaitlistFormProps {
  /**
   * "card" renders on the standalone /tier-2-waitlist page (own border),
   * "modal" is the borderless layout for use inside a Dialog (no current
   * caller). Default: "card".
   */
  variant?: "card" | "modal";
}

/**
 * Tier 2 is deprioritized and is NOT collecting waitlist signups. This panel
 * replaces the former waitlist form: it tells visitors Tier 2 is coming and
 * routes the interested to Tier 1 (Foundations) — the surest way to be first
 * when Tier 2 opens. Rendered by the /tier-2-waitlist page. No Edge Function call.
 *
 * Tier 1 is $97, full stop (founder decision 2026-09-10: no price increase is
 * advertised anywhere). The price is set on the LearnWorlds enrollment page — never a coupon
 * code here (an in-app code once stacked on LearnWorlds' built-in discount and
 * dropped the course to $0).
 */
export function TierTwoWaitlistForm({ variant = "card" }: TierTwoWaitlistFormProps) {
  return (
    <div
      className={
        variant === "card"
          ? "rounded-lg p-10 bg-background border-2 text-center"
          : "p-2 text-center"
      }
      style={variant === "card" ? { borderColor: "hsl(var(--eden-gold))" } : undefined}
    >
      <p
        className="font-accent text-xs tracking-[0.3em] uppercase mb-4"
        style={{ color: "hsl(var(--eden-gold-ink))" }}
      >
        Coming Soon
      </p>
      <h3
        className="font-serif text-2xl font-bold mb-3"
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        The surest way into Tier 2 is to start with Tier 1.
      </h3>
      <div
        className="w-12 h-px mx-auto mb-5"
        style={{ backgroundColor: "hsl(var(--eden-gold))" }}
      />
      <p className="font-body text-base leading-relaxed text-muted-foreground mb-2">
        Tier 1, the Foundations of Constitutional Herbalism, is{" "}
        <strong style={{ color: "hsl(var(--eden-bark))" }}>$97</strong>. One payment, self-paced, lifetime access.
      </p>
      <p className="font-body text-base leading-relaxed text-muted-foreground mb-7">
        Tier 1 students are the first to hear when Tier 2 opens, and Tier 2 grows straight out of the foundation you build now.
      </p>
      <a href={TIER_1_URL} target="_blank" rel="noopener noreferrer">
        <Button
          variant="eden"
          size="xl"
          className="whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] h-auto py-3 px-6"
        >
          Start with Tier 1 →
        </Button>
      </a>
      <p className="font-body text-xs text-center text-muted-foreground mt-4">
        No coupon code needed. The price you see is the price.
      </p>
    </div>
  );
}

export default TierTwoWaitlistForm;
