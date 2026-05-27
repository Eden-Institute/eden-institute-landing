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
      <section
        id="framework"
        aria-label="Framework"
        className="px-8"
        style={{
          backgroundColor: "hsl(var(--cream-light))",
          paddingTop: "clamp(60px, 8vw, 120px)",
          paddingBottom: "clamp(60px, 8vw, 120px)",
        }}
      >
        <div className="max-w-[1120px] mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <p
              className="uppercase tracking-[0.18em] mb-6"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 600,
                fontSize: "11px",
                color: "hsl(var(--green-mid))",
              }}
            >
              THE FRAMEWORK
            </p>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 400,
                fontSize: "clamp(28px, 4vw, 48px)",
                lineHeight: 1.15,
                color: "hsl(var(--green-deep))",
                marginBottom: "20px",
              }}
            >
              Four doors. One mission.
            </h2>
            <p
              className="mx-auto"
              style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontSize: "18px",
                color: "hsl(var(--ink-soft))",
                maxWidth: "640px",
                lineHeight: 1.6,
              }}
            >
              This page is the teaser. Each door leads to its own full explanation.
            </p>
          </div>

          {/* 4-card grid */}
          <div className="grid grid-cols-1 min-[880px]:grid-cols-4 gap-6">
            {[
              {
                badge: "LAUNCHING AUGUST 1, 2026",
                eyebrow: "FOR THE FAMILY",
                title: "Eden's Table",
                subtitle: "K-12 Homeschool Curriculum",
                body: "The family doorway. Children learn how God designed their bodies and the plants He gave — alongside the parent who teaches them.",
                cta: "Get the first two weeks free →",
                href: "/homeschool#early-access",
                external: false,
              },
              {
                badge: "FOUNDATIONS LIVE · $97 → $197 ON AUGUST 1",
                eyebrow: "FOR THE ADULT",
                title: "Eden Institute Courses",
                subtitle: "Foundations + Body Systems",
                body: "The parent track. From foundational worldview to terrain-based clinical literacy. Reach genuine clinical competence over time.",
                cta: "See the Courses →",
                href: "/courses",
                external: false,
              },
              {
                badge: "LIVE NOW",
                eyebrow: "FOR THE PRACTITIONER",
                title: "Eden Apothecary",
                subtitle: "Pocket Materia Medica App",
                body: "The tool. Constitutional pattern matching, 100 monograph library, clinical reasoning support. So you don't have to hold it all in your head.",
                cta: "Open the Apothecary →",
                href: "/apothecary/start",
                external: false,
              },
              {
                badge: "AVAILABLE NOW ON AMAZON",
                eyebrow: "WHERE IT STARTED",
                title: "Back to Eden",
                subtitle: "The book where the framework began",
                body: "The origin text — Scripture-anchored herbal healing, written out in full. The work that started everything Eden Institute teaches.",
                cta: "Read the Book →",
                href: "https://www.amazon.com/dp/B0GPW5BZ32?tag=theedeninstit-20",
                external: true,
              },
            ].map((card) => (
              <article
                key={card.title}
                className="flex flex-col bg-white transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]"
                style={{
                  borderRadius: "4px",
                  border: "0.5px solid hsl(var(--sage-border) / 0.6)",
                  borderTop: "3px solid hsl(var(--green-deep))",
                  padding: "32px",
                }}
              >
                {/* Badge */}
                <span
                  className="self-start inline-block mb-5"
                  style={{
                    backgroundColor: "hsl(var(--honey) / 0.15)",
                    color: "hsl(var(--honey))",
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 600,
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    padding: "5px 10px",
                    borderRadius: "999px",
                    lineHeight: 1.3,
                  }}
                >
                  {card.badge}
                </span>

                {/* Eyebrow */}
                <p
                  className="uppercase mb-3"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 600,
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    color: "hsl(var(--green-mid))",
                  }}
                >
                  {card.eyebrow}
                </p>

                {/* Title */}
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 500,
                    fontSize: "28px",
                    lineHeight: 1.2,
                    color: "hsl(var(--green-deep))",
                    marginBottom: "6px",
                  }}
                >
                  {card.title}
                </h3>

                {/* Subtitle */}
                <p
                  className="italic mb-4"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "18px",
                    color: "hsl(var(--green-mid))",
                  }}
                >
                  {card.subtitle}
                </p>

                {/* Body */}
                <p
                  className="flex-1"
                  style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: "16px",
                    lineHeight: 1.65,
                    color: "hsl(var(--ink-soft))",
                    marginBottom: "24px",
                  }}
                >
                  {card.body}
                </p>

                {/* CTA */}
                <a
                  href={card.href}
                  {...(card.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="self-start inline-flex items-center justify-center transition-colors duration-200 min-h-[44px]"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    letterSpacing: "0.06em",
                    color: "hsl(var(--green-deep))",
                    border: "1px solid hsl(var(--green-deep))",
                    padding: "10px 20px",
                    borderRadius: "2px",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "hsl(var(--green-deep))";
                    e.currentTarget.style.color = "hsl(var(--cream-light))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "hsl(var(--green-deep))";
                  }}
                >
                  {card.cta}
                </a>
              </article>
            ))}
          </div>
        </div>
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
