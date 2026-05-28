import { useState } from "react";
import { BANDS, type BandSpec } from "@/lib/homeschool/data";
import WaitlistModal from "@/components/landing/WaitlistModal";

const HS_AUDIENCE_ID = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";

/**
 * FourBands (§8) — K-12 roadmap ladder. Four cards horizontally on
 * desktop (1-col stack below 880px). Sprouts + Seedlings render full-
 * color w/ Stripe-checkout-stub CTAs; Cultivators + Practitioners render
 * grayed w/ waitlist CTAs that open the shared WaitlistModal.
 *
 * Stripe checkout IDs are placeholders (Phase 2 of POD Setup Timeline
 * creates the real Stripe price IDs). The Reserve buttons render
 * data-checkout-id attrs + a click warning so any accidental click in
 * production hits a discoverable warning rather than a broken redirect.
 */
function BandCard({
  band,
  onWaitlist,
}: {
  band: BandSpec;
  onWaitlist: (b: BandSpec) => void;
}) {
  const grayed = band.status === "waitlist";
  return (
    <div
      className="rounded-sm p-6 flex flex-col"
      style={{
        backgroundColor: grayed ? "hsl(var(--cream-warm))" : "hsl(var(--cream-light))",
        border: grayed
          ? "1px dashed hsl(var(--sage-pale))"
          : "1px solid hsl(var(--sage-border))",
        opacity: grayed ? 0.78 : 1,
      }}
    >
      <h3
        className="font-serif text-2xl font-bold"
        style={{ color: "hsl(var(--ink))" }}
      >
        {band.name}
      </h3>
      <p
        className="text-[11px] uppercase tracking-[0.2em] mt-1 mb-2 font-sans"
        style={{ color: grayed ? "hsl(var(--ink-soft))" : "hsl(var(--honey))" }}
      >
        {band.grades}
      </p>
      <p
        className="text-xs mb-4"
        style={{ color: "hsl(var(--ink-soft))" }}
      >
        {band.launch}
      </p>
      <p
        className="text-sm leading-relaxed mb-5 flex-1"
        style={{ color: "hsl(var(--ink-soft))" }}
      >
        {band.description}
      </p>
      {band.contentLine && (
        <p
          className="text-xs mb-5 italic"
          style={{ color: "hsl(var(--sage-border))" }}
        >
          {band.contentLine}
        </p>
      )}
      {band.status === "available" ? (
        <a
          href={band.ctaHref}
          data-checkout-id={band.ctaCheckoutId}
          onClick={(e) => {
            e.preventDefault();
            // Stripe checkout URL is added in Phase 2 of POD Setup Timeline.
            // Until then, surface a visible warning so accidental clicks are
            // discoverable rather than silently broken.
            // eslint-disable-next-line no-console
            console.warn(
              `[homeschool] Checkout ID "${band.ctaCheckoutId}" not yet wired to Stripe. Phase 2 task.`
            );
            window.alert(
              "Founders Edition checkout opens August 1, 2026. Use the free sample-weeks button up top to join the founders list."
            );
          }}
          className="text-center min-h-[48px] px-5 py-3 rounded-sm text-sm tracking-wide font-sans inline-flex items-center justify-center border-2 transition-colors"
          style={{
            borderColor: "hsl(var(--green-deep))",
            color: "hsl(var(--green-deep))",
          }}
        >
          {band.ctaLabel}
        </a>
      ) : (
        <button
          onClick={() => onWaitlist(band)}
          className="text-center min-h-[48px] px-5 py-3 rounded-sm text-sm tracking-wide font-sans inline-flex items-center justify-center border-2 transition-colors"
          style={{
            borderColor: "hsl(var(--green-deep))",
            color: "hsl(var(--green-deep))",
            backgroundColor: "transparent",
          }}
        >
          {band.ctaLabel}
        </button>
      )}
    </div>
  );
}

export default function FourBands() {
  const [waitlistBand, setWaitlistBand] = useState<BandSpec | null>(null);

  return (
    <>
      <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream))" }}>
        <div className="max-w-6xl mx-auto">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
            style={{ color: "hsl(var(--honey))" }}
          >
            The K-12 Path
          </p>
          <h2
            className="font-serif text-3xl md:text-4xl text-center mb-12"
            style={{ color: "hsl(var(--ink))" }}
          >
            Eden's Table Grows With Your Family.
          </h2>

          <div className="grid gap-6 min-[880px]:grid-cols-4">
            {BANDS.map((b) => (
              <BandCard key={b.key} band={b} onWaitlist={setWaitlistBand} />
            ))}
          </div>

          <p
            className="text-center text-sm mt-12 max-w-3xl mx-auto italic"
            style={{ color: "hsl(var(--ink-soft))" }}
          >
            Founders families lock in current pricing on Cultivators and
            Practitioners when they launch. Your seat at the table is permanent.
          </p>
        </div>
      </section>

      <WaitlistModal
        open={waitlistBand !== null}
        onOpenChange={(o) => !o && setWaitlistBand(null)}
        audienceId={HS_AUDIENCE_ID}
        title={waitlistBand ? `Join the ${waitlistBand.name} Waitlist` : "Join the Waitlist"}
        funnel="edens_table"
        metadata={{
          surface: "edens_table_page",
          band_waitlist: waitlistBand?.key,
        }}
      />
    </>
  );
}
