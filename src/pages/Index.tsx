import { useEffect } from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  useEffect(() => {
    // Resolve viewer tier on mount (preserved from prior implementation).
    supabase.rpc("current_user_tier" as never).then(() => {
      /* tier resolved — UI gating will consume in later chunks */
    }, () => {
      /* swallow — anon fallback handled downstream */
    });
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />

      {/* ─── SECTION 1: HERO ─── */}
      <section
        id="hero"
        aria-label="Hero"
        className="relative flex items-center justify-center px-8"
        style={{
          backgroundColor: "hsl(var(--cream))",
          backgroundImage: `
            radial-gradient(circle at 100% 0%, hsl(var(--green-mid) / 0.08), transparent 50%),
            radial-gradient(circle at 0% 100%, hsl(var(--honey) / 0.08), transparent 50%)
          `,
          paddingTop: "clamp(60px, 8vw, 120px)",
          paddingBottom: "clamp(60px, 8vw, 120px)",
        }}
      >
        <div className="max-w-[960px] w-full mx-auto text-center">
          {/* Eyebrow */}
          <p
            className="uppercase tracking-[0.18em] mb-6"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 600,
              fontSize: "11px",
              color: "hsl(var(--green-mid))",
            }}
          >
            THE EDEN INSTITUTE
          </p>

          {/* H1 */}
          <h1
            className="mb-0"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(38px, 5vw, 64px)",
              lineHeight: 1.1,
              color: "hsl(var(--green-deep))",
            }}
          >
            <span className="block">A framework our culture forgot.</span>
            <span
              className="block italic"
              style={{ color: "hsl(var(--rust))" }}
            >
              We are teaching it back.
            </span>
          </h1>

          {/* Honey hairline rule */}
          <div
            className="mx-auto"
            style={{
              width: "80px",
              height: "2px",
              backgroundColor: "hsl(var(--honey))",
              marginTop: "28px",
              marginBottom: "28px",
            }}
          />

          {/* Lead paragraph */}
          <p
            className="mx-auto"
            style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontSize: "19px",
              color: "hsl(var(--ink))",
              maxWidth: "680px",
              lineHeight: 1.7,
            }}
          >
            Our bodies were designed to signal. To repair. To steward themselves
            with help from the plants God gave for food and healing.{" "}
            <span
              className="italic"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                color: "hsl(var(--green-dark))",
              }}
            >
              Somewhere along the way, we stopped listening.
            </span>
          </p>
        </div>
      </section>

      {/* ─── SECTION 2: FOUR DOORS ─── */}
      <section id="four-doors" aria-label="Four doors">
        {/* TODO Chunk 4 — four doors */}
      </section>

      {/* ─── SECTION 3: FRAMEWORK ─── */}
      <section id="framework" aria-label="Framework">
        {/* TODO Chunk 5 — framework */}
      </section>

      {/* ─── SECTION 4: FOUNDER ─── */}
      <section id="founder" aria-label="Founder">
        {/* TODO Chunk 6 — founder */}
      </section>

      {/* ─── SECTION 5: CTA ─── */}
      <section id="cta" aria-label="Call to action">
        {/* TODO Chunk 7 — final CTA */}
      </section>

      <Footer />
    </main>
  );
};

export default Index;
