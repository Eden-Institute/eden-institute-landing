import { PRICING } from "@/lib/homeschool/data";

/**
 * PricingCenterpiece (§9) — the page's load-bearing conversion section.
 *
 * Dark forest green full-bleed band. Three-column pricing grid for
 * Sprouts Complete / Seedlings Complete / Two-Band Family Bundle.
 * Two add-on cards below (Mother+Family combo + K-12 Founders Lock).
 * Large honey "Reserve Your Founders Edition Seat" CTA centered.
 *
 * All pricing numbers come from PRICING in src/lib/homeschool/data.ts,
 * sourced from Eden_Table_Pricing_Worksheet_v1_1.xlsx "Bundle Pricing"
 * tab. 20% gross margin floor confirmed against the worksheet.
 */
const BUNDLES = [
  {
    key: "sprouts",
    name: "Sprouts Complete",
    description: "All 8 Sprouts SKUs (K-2 band)",
    founders: PRICING.bundles.sprouts.founders,
    public: PRICING.bundles.sprouts.public,
    sku: PRICING.bundles.sprouts.sku,
  },
  {
    key: "seedlings",
    name: "Seedlings Complete",
    description: "All 8 Seedlings SKUs (3-5 band)",
    founders: PRICING.bundles.seedlings.founders,
    public: PRICING.bundles.seedlings.public,
    sku: PRICING.bundles.seedlings.sku,
  },
  {
    key: "twoBand",
    name: "Two-Band Family Bundle",
    description: "All 16 SKUs (both bands)",
    founders: PRICING.bundles.twoBand.founders,
    public: PRICING.bundles.twoBand.public,
    sku: PRICING.bundles.twoBand.sku,
    featured: true,
  },
] as const;

function handleStripeStub(sku: string) {
  // eslint-disable-next-line no-console
  console.warn(
    `[homeschool] Pricing checkout "${sku}" not yet wired to Stripe. Phase 2 task.`
  );
  window.alert(
    "Founders Edition checkout opens August 1, 2026. Use the free sample-weeks button up top to join the founders list."
  );
}

export default function PricingCenterpiece() {
  return (
    <section
      className="px-6 py-20 md:py-28"
      style={{ backgroundColor: "hsl(var(--green-deep))" }}
    >
      <div className="max-w-6xl mx-auto">
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
          style={{ color: "hsl(var(--honey-pale))" }}
        >
          Founders Edition
        </p>
        <h2
          className="font-serif italic text-3xl md:text-4xl text-center mb-12"
          style={{ color: "hsl(var(--cream))" }}
        >
          Founders pricing closes July 31, 2026. Full pricing returns August 1.
        </h2>

        <div className="grid gap-6 min-[880px]:grid-cols-3 mb-12">
          {BUNDLES.map((b) => (
            <div
              key={b.key}
              className="rounded-sm p-6 flex flex-col"
              style={{
                backgroundColor:
                  "featured" in b && b.featured
                    ? "hsl(var(--cream))"
                    : "hsl(var(--cream) / 0.94)",
                border:
                  "featured" in b && b.featured
                    ? "2px solid hsl(var(--honey))"
                    : "1px solid hsl(var(--cream) / 0.4)",
              }}
            >
              <h3
                className="font-serif text-xl font-bold mb-2"
                style={{ color: "hsl(var(--ink))" }}
              >
                {b.name}
              </h3>
              <p className="text-sm mb-5" style={{ color: "hsl(var(--ink-soft))" }}>
                {b.description}
              </p>
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-serif text-4xl" style={{ color: "hsl(var(--green-deep))" }}>
                    ${b.founders}
                  </span>
                  <span className="text-xs uppercase tracking-wide" style={{ color: "hsl(var(--honey))" }}>
                    Founders
                  </span>
                </div>
                <p className="text-xs" style={{ color: "hsl(var(--ink-soft))" }}>
                  Public (Aug 1): <s>${b.public}</s>
                </p>
              </div>
              <a
                href="#"
                data-checkout-id={b.sku}
                onClick={(e) => { e.preventDefault(); handleStripeStub(b.sku); }}
                className="mt-auto min-h-[48px] px-5 py-3 rounded-sm text-sm tracking-wide font-sans text-center inline-flex items-center justify-center"
                style={{
                  backgroundColor: "hsl(var(--honey))",
                  color: "hsl(var(--ink))",
                }}
              >
                Reserve →
              </a>
            </div>
          ))}
        </div>

        <p
          className="text-center text-sm mb-10 italic"
          style={{ color: "hsl(var(--cream) / 0.75)" }}
        >
          À la carte purchase available — see all eight products below.
        </p>

        {/* Add-on cards */}
        <div className="grid gap-6 min-[880px]:grid-cols-2 mb-12">
          <div
            className="rounded-sm p-6"
            style={{
              backgroundColor: "hsl(var(--green-deep))",
              border: "1px solid hsl(var(--honey) / 0.4)",
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] mb-2 font-sans" style={{ color: "hsl(var(--honey))" }}>
              Mother + Family Founders Package
            </p>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "hsl(var(--cream) / 0.9)" }}>
              Add the Foundations Course (adult Tier 1 of Eden Institute) at
              ${PRICING.foundationsCourse.founders} Founders / ${PRICING.foundationsCourse.public} Public.
            </p>
            <p className="font-serif text-2xl" style={{ color: "hsl(var(--cream))" }}>
              Combined: ${PRICING.motherFamilyCombo.founders} Founders / ${PRICING.motherFamilyCombo.public} Public.
            </p>
          </div>
          <div
            className="rounded-sm p-6"
            style={{
              backgroundColor: "hsl(var(--green-deep))",
              border: "1px solid hsl(var(--honey) / 0.4)",
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] mb-2 font-sans" style={{ color: "hsl(var(--honey))" }}>
              K-12 Founders Lock
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--cream) / 0.9)" }}>
              Lock Founders pricing on Cultivators (2027) and Practitioners
              (2028) when you buy a launch bundle. Your seat is permanent.
            </p>
          </div>
        </div>

        <p
          className="text-center text-xs mb-2"
          style={{ color: "hsl(var(--cream) / 0.75)" }}
        >
          Free shipping on all bundles (US). $9.99 flat shipping under ${PRICING.shippingFreeThreshold}.
        </p>
        <p
          className="text-center text-xs mb-10"
          style={{ color: "hsl(var(--cream) / 0.75)" }}
        >
          Founders Edition includes lifetime access to your bands + the locked
          Founders Circle community + monthly Q&amp;A office hours through launch + 6 months.
        </p>

        <div className="text-center">
          <a
            href="#"
            data-checkout-id="two_band_family_founders"
            onClick={(e) => { e.preventDefault(); handleStripeStub("two_band_family_founders"); }}
            className="inline-flex items-center justify-center min-h-[56px] px-10 py-4 rounded-sm text-base tracking-wide font-sans"
            style={{
              backgroundColor: "hsl(var(--honey))",
              color: "hsl(var(--ink))",
            }}
          >
            Reserve Your Founders Edition Seat →
          </a>
          <p className="mt-4 text-xs" style={{ color: "hsl(var(--cream) / 0.75)" }}>
            <a href="#top" className="underline">Or get the free sample weeks first →</a>
          </p>
        </div>
      </div>
    </section>
  );
}
