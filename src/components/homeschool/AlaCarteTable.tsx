import { PRODUCTS, PRICING } from "@/lib/homeschool/data";

/**
 * AlaCarteTable (§10) — simple 3-col table (product / founders / public).
 * Responsive: stacks to label/value pairs below 880px so prices stay
 * legible on mobile.
 *
 * Footer line calculates Sprouts-Complete savings from PRICING data so
 * the number stays in sync if the worksheet shifts.
 */
export default function AlaCarteTable() {
  const sprBundle = PRICING.bundles.sprouts.founders;
  const sprSavings = PRICING.alaCarteTotalFounders - sprBundle;
  const twoBandBundle = PRICING.bundles.twoBand.founders;
  const twoSinglesSum = PRICING.bundles.sprouts.founders + PRICING.bundles.seedlings.founders;
  const twoBandSavings = twoSinglesSum - twoBandBundle;

  return (
    <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream-light))" }}>
      <div className="max-w-4xl mx-auto">
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
          style={{ color: "hsl(var(--honey))" }}
        >
          Buy Individual Products
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl text-center mb-10"
          style={{ color: "hsl(var(--ink))" }}
        >
          Build Your Own Bundle.
        </h2>

        <div
          className="rounded-sm overflow-hidden"
          style={{ border: "1px solid hsl(var(--sage-pale))" }}
        >
          {/* Desktop header */}
          <div
            className="hidden min-[880px]:grid grid-cols-[2fr_1fr_1fr] px-5 py-3 text-[11px] uppercase tracking-[0.15em] font-sans"
            style={{ backgroundColor: "hsl(var(--cream-warm))", color: "hsl(var(--ink-soft))" }}
          >
            <span>Product</span>
            <span className="text-right">Founders Price</span>
            <span className="text-right">Public Price</span>
          </div>
          {PRODUCTS.map((p, i) => (
            <div
              key={p.code}
              className="px-5 py-4 grid grid-cols-2 min-[880px]:grid-cols-[2fr_1fr_1fr] gap-2 items-center"
              style={{
                backgroundColor: i % 2 === 0 ? "hsl(var(--cream-light))" : "hsl(var(--cream))",
              }}
            >
              <span
                className="text-sm font-serif col-span-2 min-[880px]:col-span-1"
                style={{ color: "hsl(var(--ink))" }}
              >
                {p.alaCarteLabel}
              </span>
              <span
                className="text-right text-sm"
                style={{ color: "hsl(var(--green-deep))" }}
              >
                <span className="min-[880px]:hidden text-[10px] uppercase tracking-wide mr-1" style={{ color: "hsl(var(--ink-soft))" }}>
                  Founders
                </span>
                ${p.foundersPrice}
              </span>
              <span
                className="text-right text-sm"
                style={{ color: "hsl(var(--ink-soft))" }}
              >
                <span className="min-[880px]:hidden text-[10px] uppercase tracking-wide mr-1">
                  Public
                </span>
                ${p.publicPrice}
              </span>
            </div>
          ))}
        </div>

        <p
          className="text-sm mt-6 text-center leading-relaxed"
          style={{ color: "hsl(var(--ink-soft))" }}
        >
          Buying all 8 separately at Founders = ${PRICING.alaCarteTotalFounders}.{" "}
          The Sprouts Complete Bundle is ${sprBundle} — saves ${sprSavings}.{" "}
          The Two-Band Family Bundle is ${twoBandBundle} — saves ${twoBandSavings} versus two single-band Complete Bundles.
        </p>
      </div>
    </section>
  );
}
