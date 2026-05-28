import { useState } from "react";
import WaitlistModal from "@/components/landing/WaitlistModal";

const HS_AUDIENCE_ID = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";

/**
 * Hero (§1) — cream background w/ subtle sage radial gradient, split layout.
 *
 * Left: mockup composite (Sprouts Wk 02 TG cover + open NB + Storybook +
 * card fan). Asset deferred per spec Open Question #7; the slot renders
 * an accessible cream placeholder labeled "Eden's Table preview" until
 * the Canva PNG ships (target July 22, 2026).
 *
 * Right: eyebrow + H1 (with italic rust-colored "Not Dependent." close)
 * + subheadline + sub-detail + dual CTA. Both CTAs feed the same
 * WaitlistModal; we pass different lead_magnet metadata so Resend
 * segmentation can route them to distinct nurture sequences without
 * needing two endpoints.
 */
export default function Hero() {
  const [openModal, setOpenModal] = useState<"sprouts" | "seedlings" | null>(null);

  return (
    <>
      <section
        className="relative px-6 py-20 md:py-28"
        style={{
          backgroundColor: "hsl(var(--cream))",
          backgroundImage:
            "radial-gradient(ellipse at 80% 20%, hsl(var(--sage-pale) / 0.35) 0%, transparent 55%)",
        }}
      >
        <div className="max-w-6xl mx-auto grid gap-12 min-[880px]:grid-cols-2 items-center">
          {/* LEFT — mockup composite slot */}
          <div className="order-2 min-[880px]:order-1">
            <div
              className="aspect-[4/3] w-full rounded-sm flex items-center justify-center"
              style={{
                backgroundColor: "hsl(var(--cream-warm))",
                border: "1px solid hsl(var(--sage-pale))",
              }}
              role="img"
              aria-label="Eden's Table curriculum preview — Teacher Guide, Student Notebook, Storybook, and card decks. Final composite image arrives July 22, 2026."
            >
              <p
                className="text-center px-6 italic"
                style={{ color: "hsl(var(--ink-soft))", fontFamily: "var(--font-accent)" }}
              >
                Curriculum preview composite<br />
                <span className="text-sm not-italic">arriving July 22, 2026</span>
              </p>
            </div>
          </div>

          {/* RIGHT — headline + CTAs */}
          <div className="order-1 min-[880px]:order-2">
            <p
              className="text-[11px] tracking-[0.3em] uppercase mb-6 font-sans"
              style={{ color: "hsl(var(--honey))" }}
            >
              Eden's Table
            </p>
            <h1
              className="font-serif text-4xl md:text-5xl lg:text-[56px] leading-tight mb-6"
              style={{ color: "hsl(var(--ink))" }}
            >
              A K-12 Herbalism Curriculum for the Family Who Wants Their Children
              Equipped —{" "}
              <em
                className="italic"
                style={{ color: "hsl(var(--rust))", fontFamily: "var(--font-accent)" }}
              >
                Not Dependent.
              </em>
            </h1>
            <p
              className="text-lg leading-relaxed mb-4 max-w-[540px]"
              style={{ color: "hsl(var(--ink-soft))" }}
            >
              Open-and-go lessons. 36 weeks per year. Scripture at every turn.
              Built by a credentialed teacher and educator for the family that
              wants their children to know how God designed their bodies and the
              plants He gave for food and healing.
            </p>
            <p
              className="text-sm mb-8"
              style={{ color: "hsl(var(--sage-border))" }}
            >
              Sprouts (K-2) and Seedlings (3-5) launching August 1, 2026.
              Cultivators (6-8) and Practitioners (9-12) following in 2027 and 2028.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setOpenModal("sprouts")}
                className="min-h-[48px] px-6 py-3 rounded-sm font-sans text-sm tracking-wide transition-colors"
                style={{
                  backgroundColor: "hsl(var(--honey))",
                  color: "hsl(var(--ink))",
                }}
              >
                Get Sprouts Weeks 1 + 2 — Free
              </button>
              <button
                onClick={() => setOpenModal("seedlings")}
                className="min-h-[48px] px-6 py-3 rounded-sm font-sans text-sm tracking-wide transition-colors border-2"
                style={{
                  borderColor: "hsl(var(--green-deep))",
                  color: "hsl(var(--green-deep))",
                  backgroundColor: "transparent",
                }}
              >
                Get Seedlings Weeks 1 + 2 — Free
              </button>
            </div>
            <p
              className="text-xs mt-4 italic"
              style={{ color: "hsl(var(--ink-soft))" }}
            >
              No credit card. Two free sample weeks sent to your inbox.
            </p>
          </div>
        </div>
      </section>

      <WaitlistModal
        open={openModal !== null}
        onOpenChange={(o) => !o && setOpenModal(null)}
        audienceId={HS_AUDIENCE_ID}
        title={
          openModal === "sprouts"
            ? "Get Sprouts Weeks 1 + 2 — Free"
            : "Get Seedlings Weeks 1 + 2 — Free"
        }
        funnel="edens_table"
        metadata={{
          surface: "edens_table_page",
          lead_magnet:
            openModal === "sprouts" ? "sprouts_wks_1_2" : "seedlings_wks_1_2",
        }}
      />
    </>
  );
}
