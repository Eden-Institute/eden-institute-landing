import { PRODUCTS, type ProductSpec } from "@/lib/homeschool/data";
import HatBadge from "./HatBadge";
import ProductMockup from "./ProductMockup";

/**
 * EightProducts (§6) — the conversion engine. 8 product cards in a
 * 2-column grid (4 rows) on desktop, 1-column stack below 880px.
 *
 * Each card pulls verbatim from PRODUCTS in src/lib/homeschool/data.ts.
 * Product specs, HAT badges, and band-availability footers live in that
 * data module so the à la carte table (§10) and pricing centerpiece (§9)
 * can read the same source of truth.
 *
 * Mockup slot uses ProductMockup atom: shows /public/homeschool-mockups/
 * PNG when present, falls back to BotanicalPlaceholder otherwise (Garden
 * Journal + Family Devotional permanently; others temporarily until
 * Camila drops the 12 master PNGs into /public/homeschool-mockups/).
 */
function ProductCard({ product }: { product: ProductSpec }) {
  // GJ and FD don't have masters yet — force the placeholder with a
  // production-status caption so the card reads as deliberate rather
  // than missing. Per Camila's Option 1 disposition.
  const noMasterYet = product.imageSprouts === null && product.imageSeedlings === null;

  return (
    <article
      className="rounded-sm overflow-hidden flex flex-col"
      style={{
        backgroundColor: "hsl(var(--cream-light))",
        border: "0.5px solid hsl(var(--sage-pale))",
        borderTop: "3px solid hsl(var(--green-deep))",
      }}
    >
      <ProductMockup
        imageSrc={product.imageSprouts}
        productName={product.name}
        forcePlaceholder={noMasterYet}
        placeholderCaption={noMasterYet ? "Mockup in production" : undefined}
      />

      <div className="p-6 flex-1 flex flex-col">
        <h3
          className="font-serif text-[22px] font-bold mb-2"
          style={{ color: "hsl(var(--ink))", fontFamily: "var(--font-accent)" }}
        >
          {product.name}
        </h3>
        <p
          className="text-sm italic mb-5"
          style={{ color: "hsl(var(--sage-border))" }}
        >
          {product.tagline}
        </p>

        <p className="text-[11px] uppercase tracking-[0.2em] mb-2 font-sans" style={{ color: "hsl(var(--ink-soft))" }}>
          Specs
        </p>
        <ul className="text-sm mb-5 space-y-1" style={{ color: "hsl(var(--ink-soft))" }}>
          {product.specs.map((s) => (
            <li key={s}>• {s}</li>
          ))}
          <li>• Weeks covered: 36 weeks per band</li>
        </ul>

        <p className="text-[11px] uppercase tracking-[0.2em] mb-2 font-sans" style={{ color: "hsl(var(--ink-soft))" }}>
          What's Inside
        </p>
        <ul className="text-sm mb-5 space-y-1" style={{ color: "hsl(var(--ink-soft))" }}>
          {product.inside.map((s) => (
            <li key={s}>• {s}</li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {product.hats.map((h) => (
            <HatBadge key={h} hat={h} compact />
          ))}
        </div>

        <p
          className="text-xs mt-auto pt-4"
          style={{ color: "hsl(var(--ink-soft))", borderTop: "1px solid hsl(var(--sage-pale))" }}
        >
          Available for: ✓ Sprouts (K-2) · ✓ Seedlings (3-5) ·
          {" "}⏳ Cultivators 2027 · ⏳ Practitioners 2028
        </p>
      </div>
    </article>
  );
}

export default function EightProducts() {
  return (
    <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream))" }}>
      <div className="max-w-6xl mx-auto">
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
          style={{ color: "hsl(var(--honey))" }}
        >
          Everything in the Box
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl text-center mb-14"
          style={{ color: "hsl(var(--ink))" }}
        >
          Eight Products. Built to Work Together.
        </h2>

        <div className="grid gap-8 min-[880px]:grid-cols-2">
          {PRODUCTS.map((p) => (
            <ProductCard key={p.code} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
