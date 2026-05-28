/**
 * FinalCta (§14) — the urgency close. Dark forest green full-bleed band.
 *
 * v1.5 launch default: date-only cap framing (Aug 1 hard cutoff, no
 * buyer-count cap). Consistent w/ §9 + §12 + §14 spec language.
 * Founder can override in PR review.
 */
export default function FinalCta() {
  return (
    <section
      className="px-6 py-20 md:py-28"
      style={{ backgroundColor: "hsl(var(--green-deep))" }}
    >
      <div className="max-w-2xl mx-auto text-center">
        <h2
          className="font-serif italic text-3xl md:text-[38px] leading-tight mb-6"
          style={{ color: "hsl(var(--cream))" }}
        >
          The Founders Cohort Closes July 31, 2026.
        </h2>
        <p
          className="text-base leading-relaxed mb-10"
          style={{ color: "hsl(var(--cream) / 0.85)" }}
        >
          Your physical curriculum in your hands the second week of August.
          Wks 1–18 at launch. Wks 19–36 delivered November. The Storybook,
          Devotional, Garden Journal, and Resource Page — all in your founders box.
        </p>

        <a
          href="#"
          data-checkout-id="two_band_family_founders"
          onClick={(e) => {
            e.preventDefault();
            // eslint-disable-next-line no-console
            console.warn(
              "[homeschool] Final CTA checkout not yet wired to Stripe. Phase 2 task."
            );
            window.alert(
              "Founders Edition checkout opens August 1, 2026. Use the free sample-weeks button up top to join the founders list."
            );
          }}
          className="inline-flex items-center justify-center min-h-[56px] px-10 py-4 rounded-sm text-base tracking-wide font-sans"
          style={{
            backgroundColor: "hsl(var(--honey))",
            color: "hsl(var(--ink))",
          }}
        >
          Reserve Your Founders Edition Seat
        </a>
        <p className="mt-5 text-xs" style={{ color: "hsl(var(--cream) / 0.75)" }}>
          <a href="#top" className="underline">
            Or get the two free sample weeks first →
          </a>
        </p>
      </div>
    </section>
  );
}
