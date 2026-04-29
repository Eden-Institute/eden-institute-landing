import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { ROUTES } from "@/lib/routes";

/**
 * §8.1.1 (Manual v4.0) — State-aware welcome strip for marketing surfaces.
 *
 * Renders only when the visitor is authed AND has a resolved Eden Pattern.
 * Anon visitors and authed-without-Pattern visitors see nothing — the
 * marketing landing's existing acquisition CTAs continue to drive them
 * toward the quiz. This component is the affordance for the cohort the
 * founder reported as a confusing dead-end: returning users with a
 * resolved Pattern who land on `/` and see "Take the quiz" everywhere.
 *
 * Mounted at the top of Index (and any future marketing surface) directly
 * under <Navbar />. Sticky-positioned so it survives scroll, but not so
 * tall that it crowds the hero — a single line of warm welcome + a
 * primary "Open Apothecary" link.
 *
 * Per Lock #14 worldview-anchoring: the copy frames the user's Pattern as
 * a known design ("your Pattern is named") rather than a wellness
 * achievement. Per Lock #47 apothecary-is-an-app framing: the link target
 * is /apothecary, not /apothecary/start (the marketing landing) — once a
 * user has a Pattern, they go straight into the app.
 */
export function WelcomeBackBanner() {
  const { user } = useAuth();
  const { data: pattern } = useEdenPattern();

  // Anon or authed-without-Pattern → render nothing. Marketing CTAs
  // already handle these states; we don't crowd the hero.
  if (!user || !pattern) return null;

  return (
    <aside
      role="region"
      aria-label="Welcome back"
      className="w-full px-6 py-3 border-b"
      style={{
        backgroundColor: "hsl(var(--eden-cream))",
        borderColor: "hsl(var(--eden-gold) / 0.4)",
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
          <span
            className="font-accent text-[10px] tracking-[0.3em] uppercase"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Welcome back
          </span>
          <span
            className="font-serif text-base"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Your Pattern: <span className="italic">{pattern}</span>
          </span>
        </div>
        <Link
          to={ROUTES.APOTHECARY}
          className="font-body text-sm font-medium px-4 py-1.5 rounded-sm tracking-wide transition-colors duration-200 min-h-[44px] flex items-center"
          style={{
            backgroundColor: "hsl(var(--eden-forest))",
            color: "hsl(var(--eden-parchment))",
          }}
        >
          Open Apothecary →
        </Link>
      </div>
    </aside>
  );
}

export default WelcomeBackBanner;
