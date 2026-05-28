import { useState } from "react";
import { PRICING } from "@/lib/homeschool/data";
import WaitlistModal from "@/components/landing/WaitlistModal";

const HS_AUDIENCE_ID = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";

/**
 * CoopLicense (§11) — new SKU for homeschool co-ops.
 *
 * Three-tier card grid + "Apply for a Co-op License" CTA. The CTA opens
 * the shared WaitlistModal w/ metadata.coop_license_application=true so
 * Resend can route applications to the founder-review inbox. Manual review
 * by founder (low volume product line per Execution Plan §3.3).
 *
 * Pricing pulls from PRICING.coop in src/lib/homeschool/data.ts. Numbers
 * sourced from worksheet "Co-op License" tab. License agreement copy + legal
 * review tracked in Execution Plan Open Decision #1.
 */
export default function CoopLicense() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream))" }}>
        <div className="max-w-6xl mx-auto">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
            style={{ color: "hsl(var(--honey))" }}
          >
            For Homeschool Co-ops
          </p>
          <h2
            className="font-serif text-3xl md:text-4xl text-center mb-6"
            style={{ color: "hsl(var(--ink))" }}
          >
            License Eden's Table for Your Co-op.
          </h2>

          <div
            className="max-w-3xl mx-auto text-base leading-relaxed mb-12 space-y-4"
            style={{ color: "hsl(var(--ink-soft))" }}
          >
            <p>
              Homeschool co-ops need shared-use rights that retail purchase
              doesn't provide. The Eden's Table Co-op License gives your group
              legitimate shared access plus one physical Complete Bundle shipped
              to the coordinator.
            </p>
            <p>
              Three tiers based on your co-op size. Annual renewal at the same
              price. Every PDF page carries your coordinator's name and co-op
              name — designed to discourage onward sharing without making your
              families feel surveilled.
            </p>
          </div>

          <div className="grid gap-6 min-[880px]:grid-cols-3 mb-12">
            {PRICING.coop.map((tier) => (
              <div
                key={tier.tierLabel}
                className="rounded-sm p-6"
                style={{
                  backgroundColor: "hsl(var(--cream-light))",
                  border: "1px solid hsl(var(--sage-border))",
                }}
              >
                <h3
                  className="font-serif text-xl font-bold mb-1"
                  style={{ color: "hsl(var(--ink))" }}
                >
                  {tier.tierLabel}
                </h3>
                <p
                  className="text-xs uppercase tracking-[0.15em] mb-5"
                  style={{ color: "hsl(var(--ink-soft))" }}
                >
                  {tier.families} families
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                  <span
                    className="font-serif text-3xl"
                    style={{ color: "hsl(var(--green-deep))" }}
                  >
                    ${tier.founders.toLocaleString()}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: "hsl(var(--honey))" }}>
                    Founders
                  </span>
                </div>
                <p className="text-xs" style={{ color: "hsl(var(--ink-soft))" }}>
                  Public: ${tier.public.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <p
            className="text-center text-sm max-w-3xl mx-auto mb-8 italic"
            style={{ color: "hsl(var(--ink-soft))" }}
          >
            Includes watermarked PDF set + one physical Complete Bundle +
            quarterly Q&amp;A with founder + priority access to Cultivators and
            Practitioners early-bird seats.
          </p>

          <div className="text-center">
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-sm text-sm tracking-wide font-sans border-2"
              style={{
                borderColor: "hsl(var(--green-deep))",
                color: "hsl(var(--green-deep))",
                backgroundColor: "transparent",
              }}
            >
              Apply for a Co-op License →
            </button>
          </div>
        </div>
      </section>

      <WaitlistModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        audienceId={HS_AUDIENCE_ID}
        title="Apply for a Co-op License"
        funnel="edens_table"
        metadata={{
          surface: "edens_table_page",
          coop_license_application: true,
        }}
      />
    </>
  );
}
