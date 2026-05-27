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
      <section id="hero" aria-label="Hero">
        {/* TODO Chunk 3 — hero */}
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
