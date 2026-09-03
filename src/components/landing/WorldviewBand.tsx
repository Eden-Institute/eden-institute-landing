/**
 * WorldviewBand — the institutional worldview thesis, surfaced on every
 * marketing page that asks the visitor to understand who Eden Institute is.
 *
 * Per Manual v3.17 §0.8 Lock #14 (worldview anchor), Lock #43 (dual-source
 * clinical citation), and Lock #44 (classical-tradition observation IN,
 * theological attribution OUT). The text below is the founder-approved
 * Draft A — same thesis on every surface so the brand voice cannot drift.
 *
 * Placement (single source of truth, imported by Index.tsx, WhyEden.tsx,
 * ApothecaryWelcome.tsx):
 *   • Index.tsx — homepage worldview band, after the hero, before the
 *     framework breakdown.
 *   • WhyEden.tsx — anchor paragraph at the head of the page; the entire
 *     page builds out from this thesis.
 *   • ApothecaryWelcome.tsx — positioning band near the top of the anon
 *     /apothecary value page, before the feature and tier breakdowns.
 *
 * Mobile-aware per project_mobile_wrapping_roadmap.md: no hover-only
 * interactions, generous line-height, responsive Tailwind utilities.
 */
import ScrollReveal from "@/components/landing/ScrollReveal";
// Botanical band, same treatment as the heroes in #433: a full-colour plate at
// 95% multiply with the content on a 92% white panel, which is what keeps the
// type legible over artwork. Used only by ApothecaryWelcome.
import bandVitalForce from "@/assets/band-vital-force.jpg";

interface WorldviewBandProps {
  /**
   * Optional small caption above the headline. Defaults to "On the source
   * of vital force" — honest, explicit, theologically named. Each surface
   * may override (e.g. WhyEden hides the caption since the page itself
   * carries the heading).
   */
  caption?: string | null;
  /** Optional headline above the thesis. Defaults to none on most surfaces. */
  headline?: string | null;
}

export function WorldviewBand({
  caption = "On the source of vital force",
  headline = null,
}: WorldviewBandProps) {
  return (
    <section
      className="relative overflow-hidden px-6 py-16 md:py-24"
      style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      aria-label="Source of vital force — Eden Institute worldview thesis"
    >
      <img
        src={bandVitalForce}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ opacity: 0.95, mixBlendMode: "multiply" }}
      />
      <div className="relative z-10 max-w-3xl mx-auto rounded-lg"
        style={{
          backgroundColor: "hsl(0 0% 100% / 0.92)",
          border: "1px solid hsl(var(--eden-gold) / 0.35)",
          padding: "clamp(24px, 3vw, 44px)",
          boxShadow: "0 2px 18px -10px rgba(30,62,46,0.28)",
        }}
      >
        <ScrollReveal>
          {caption ? (
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-4 text-center"
              style={{ color: "hsl(var(--eden-gold-ink))" }}
            >
              {caption}
            </p>
          ) : null}
          {headline ? (
            <h2
              className="font-serif text-3xl md:text-4xl font-bold mb-6 text-center"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {headline}
            </h2>
          ) : null}
          <p
            className="font-body text-base md:text-lg leading-relaxed"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            The pulse, the tongue, the way a body runs hot or cold or damp
            or dry — herbalists across every culture and every century have
            observed the same human body and named what they saw. We honor
            every tradition&rsquo;s careful observation. What we don&rsquo;t
            carry forward is the spiritual story those traditions tell
            about where life comes from. We name the source of vital force
            plainly: it is the Holy Spirit, the breath of God, the
            fingerprint of the Creator pressed into every cell. Yahweh is
            the source of intelligence in your skin and your blood and
            your sleep and your strength. Karma didn&rsquo;t put it there.
            Planets didn&rsquo;t put it there. The Tao didn&rsquo;t put
            it there. God did. Everything else we teach — the patterns,
            the herbs, the diagnostics — sits on top of that one truth.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default WorldviewBand;
