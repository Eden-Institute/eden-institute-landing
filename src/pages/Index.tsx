import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram } from "lucide-react";
import Footer from "@/components/landing/Footer";
import AssessmentModal from "@/components/landing/AssessmentModal";
import { BotanicalLeafTopRight, BotanicalLeafBottomLeft, GoldDivider } from "@/components/landing/BotanicalAccents";
import ScrollReveal from "@/components/landing/ScrollReveal";

// Unsplash photography
const HERO_IMG = "https://images.unsplash.com/photo-1771128264855-1c032332cbc8?auto=format&fit=crop&w=1920&q=80";
const HERBS_SHELF_IMG = "https://images.unsplash.com/photo-1580116270858-8a0d62b15426?auto=format&fit=crop&w=1200&q=80";
const MORTAR_IMG = "https://images.unsplash.com/photo-1492552085122-36706c238263?auto=format&fit=crop&w=1200&q=80";
const HERBS_TABLE_IMG = "https://images.unsplash.com/photo-1726996155615-e986ed87c9d4?auto=format&fit=crop&w=1200&q=80";

const Index = () => {
  const [assessmentModal, setAssessmentModal] = useState(false);

  useEffect(() => {
    if (window.location.hash === "#assessment") {
      setAssessmentModal(true);
    }
  }, []);

  const openQuiz = () => setAssessmentModal(true);

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* ─── NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur border-b" style={{ backgroundColor: "hsla(40, 40%, 97%, 0.95)", borderColor: "hsl(var(--eden-gold) / 0.2)" }}>
        <div className="eden-container flex items-center justify-between py-3 px-6">
          <Link to="/" className="font-serif text-lg font-bold tracking-wide" style={{ color: "hsl(var(--eden-forest))" }}>
            The Eden Institute
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="font-body text-sm hover:opacity-80 transition-colors hidden sm:inline" style={{ color: "hsl(var(--eden-forest))" }}>
              Home
            </Link>
            <Link to="/why-eden" className="font-body text-sm hover:opacity-80 transition-colors hidden sm:inline" style={{ color: "hsl(var(--eden-forest))" }}>
              Why Eden
            </Link>
            <button
              onClick={openQuiz}
              className="!inline-block !w-auto font-body text-sm font-semibold px-4 py-1.5 rounded transition-all hover:opacity-90"
              style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}
            >
              Free Quiz
            </button>
          </div>
        </div>
      </nav>

      {/* ─── SECTION 1: HERO ─── */}
      <section id="hero" className="pt-20 relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Full-width background image */}
        <div className="absolute inset-0">
          <img
            src={HERO_IMG}
            alt="Rustic apothecary with dried herbs in glass jars on wooden shelves"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Cream/dark overlay for readability */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsla(40, 33%, 93%, 0.82) 0%, hsla(40, 33%, 93%, 0.75) 50%, hsla(40, 33%, 93%, 0.88) 100%)" }} />
        </div>

        {/* Botanical line-art accents */}
        <BotanicalLeafTopRight className="absolute top-0 right-0 w-48 md:w-72 lg:w-96 h-48 md:h-72 lg:h-96 opacity-[0.08] pointer-events-none" style={{ color: "hsl(var(--eden-forest))" }} />
        <BotanicalLeafBottomLeft className="absolute bottom-0 left-0 w-48 md:w-72 lg:w-96 h-48 md:h-72 lg:h-96 opacity-[0.06] pointer-events-none" style={{ color: "hsl(var(--eden-forest))" }} />

        <div className="eden-container text-center px-6 relative z-10 py-20 md:py-28">
          <ScrollReveal>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-5" style={{ color: "hsl(var(--eden-bark))" }}>
              The Herb Wasn't the Problem.
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p className="font-body text-xl sm:text-2xl md:text-3xl mb-10 font-medium" style={{ color: "hsl(var(--eden-bark) / 0.75)" }}>
              You were using it like a pill.
            </p>
          </ScrollReveal>

          <div className="eden-divider" />

          <ScrollReveal delay={200}>
            <p className="font-body text-base sm:text-lg md:text-xl text-muted-foreground max-w-[680px] mx-auto leading-relaxed mb-10">
              You tried the herb. It didn't work. So you assumed herbs don't work. But the herb was never the problem — the approach was. Real herbalism doesn't match a symptom to a supplement. It matches a <em>person</em> to a <em>plant</em>. Your constitution. Your tissue state. Your terrain. When you understand the pattern God designed into your body, the plant He designed to meet it becomes precise — not guesswork.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <Button
              variant="eden"
              size="xl"
              className="min-h-[48px] text-sm sm:text-base px-4 sm:px-8 max-w-[90vw] whitespace-normal leading-snug"
              onClick={openQuiz}
              style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}
            >
              Discover Your Constitution — Take the Free Quiz
            </Button>

            <p className="mt-4 font-body text-sm" style={{ color: "hsl(var(--eden-sage))" }}>
              Takes 2 minutes. No email required to start.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── BANNER: What Makes Us Different ─── */}
      <section className="py-5 md:py-6 px-6" style={{ backgroundColor: "hsl(var(--eden-gold))" }}>
        <div className="eden-container">
          <Link
            to="/why-eden"
            className="flex items-center justify-center gap-3 group"
          >
            <span
              className="font-serif text-base sm:text-lg md:text-xl font-semibold tracking-wide group-hover:underline underline-offset-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              What makes our program different?
            </span>
            <span
              className="font-serif text-xl md:text-2xl transition-transform group-hover:translate-x-1"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              →
            </span>
          </Link>
        </div>
      </section>

      <GoldDivider />

      {/* ─── SECTION 2: THE INSIGHT ─── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        {/* Background herb image at low opacity */}
        <img
          src={HERBS_SHELF_IMG}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.08] mix-blend-luminosity"
        />
        <div className="section-padding-lg relative z-10">
          <div className="eden-container px-6">
            <ScrollReveal>
              <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-14" style={{ color: "hsl(var(--eden-parchment))" }}>
                Why Herbs Work for Some People and Not Others
              </h2>
            </ScrollReveal>

            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {[
                {
                  title: "Every Body Carries a Pattern",
                  body: "God didn't make every body the same. Some people run hot. Some run cold. Some are dry, some are damp. These aren't random — they're constitutional patterns. When you don't know your pattern, you're guessing. When you do, you're matching.",
                },
                {
                  title: "Every Plant Carries One Too",
                  body: "Chamomile isn't just 'calming.' It's cooling, relaxing, and moisture-restoring. That matters. A cooling herb given to someone who's already cold won't help — it'll make things worse. The precision is in the match.",
                },
                {
                  title: "Most Programs Skip This Entirely",
                  body: "Most herbalism education teaches you WHAT to take. We teach you HOW to think. Constitution. Tissue state. Terrain. When you learn the framework, you stop chasing protocols and start making decisions — grounded ones.",
                },
              ].map((card, i) => (
                <ScrollReveal key={card.title} delay={i * 120}>
                  <div
                    className="rounded-lg p-6 md:p-8 shadow-lg"
                    style={{
                      backgroundColor: "hsl(var(--eden-parchment))",
                      borderTop: "3px solid hsl(var(--eden-gold))",
                    }}
                  >
                    <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-4">
                      {card.title}
                    </h3>
                    <p className="font-body text-base text-muted-foreground leading-relaxed">
                      {card.body}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            {/* Accent image */}
            <ScrollReveal delay={200}>
              <div className="mt-12 flex justify-center">
                <img
                  src={HERBS_SHELF_IMG}
                  alt="Dried herbs and spices on rustic wooden shelves"
                  className="w-full max-w-2xl h-48 md:h-56 object-cover rounded-lg shadow-xl opacity-90"
                  style={{ border: "2px solid hsl(var(--eden-gold) / 0.3)" }}
                />
              </div>
            </ScrollReveal>

            <div className="text-center mt-12">
              <Button
                variant="eden"
                size="xl"
                className="min-h-[48px] text-sm sm:text-base px-8"
                onClick={openQuiz}
              >
                Find Your Pattern — Take the Quiz
              </Button>
            </div>
          </div>
        </div>
      </section>

      <GoldDivider />

      {/* ─── SECTION 3: THE COURSE ─── */}
      <section id="course" className="section-padding-lg parchment-texture relative overflow-hidden">
        <div className="eden-container px-6 relative z-10">
          <ScrollReveal>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-6">
              A Real Education in Biblical Clinical Herbalism
            </h2>

            <p className="font-body text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto text-center leading-relaxed mb-14">
              The Eden Institute is a structured, three-tier clinical herbalism program anchored in Scripture and built with academic rigor. We don't sell supplement stacks or weekend certifications. We teach you to read the body, understand the terrain, and match the person to the plant — the way God designed it.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
            {/* Tier 1 */}
            <ScrollReveal delay={0}>
              <div
                className="rounded-lg p-6 md:p-8 flex flex-col shadow-md hover:shadow-lg transition-shadow duration-300"
                style={{
                  backgroundColor: "hsl(var(--eden-cream))",
                  border: "1.5px solid hsl(var(--eden-gold) / 0.4)",
                }}
              >
                <p
                  className="font-accent text-sm uppercase tracking-[0.15em] font-semibold mb-2"
                  style={{ color: "hsl(var(--eden-gold))" }}
                >
                  Tier 1
                </p>
                <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-1">
                  Foundations of Biblical Herbalism
                </h3>
                <p className="font-body text-sm text-muted-foreground mb-4">
                  10 video lessons across 3 parts
                </p>
                <p className="font-body text-base text-muted-foreground leading-relaxed mb-6 flex-1">
                  Constitutional assessment. The Five Tenets of Health. Terrain-based thinking. Biblical theology of healing. Companion worksheets, quizzes, Sensory Exploration Guide, and Certificate of Completion.
                </p>
                {/* Small herb accent image */}
                <div className="mb-4 rounded overflow-hidden" style={{ height: "100px" }}>
                  <img src={HERBS_TABLE_IMG} alt="Fresh herbs on a rustic table" className="w-full h-full object-cover opacity-80" />
                </div>
                <p className="font-serif text-lg font-bold text-foreground mb-1">
                  $197 — Payment plans available
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  Includes companion textbook materials
                </p>
              </div>
            </ScrollReveal>

            {/* Tier 2 */}
            <ScrollReveal delay={150}>
              <div
                className="rounded-lg p-6 md:p-8 flex flex-col shadow-md hover:shadow-lg transition-shadow duration-300"
                style={{
                  backgroundColor: "hsl(var(--eden-cream))",
                  border: "1.5px solid hsl(var(--eden-gold) / 0.4)",
                }}
              >
                <p
                  className="font-accent text-sm uppercase tracking-[0.15em] font-semibold mb-2"
                  style={{ color: "hsl(var(--eden-gold))" }}
                >
                  Tier 2
                </p>
                <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-1">
                  Body Systems &amp; Clinical Literacy
                </h3>
                <p className="font-body text-sm text-muted-foreground mb-4">
                  14 chapters of textbook-level depth
                </p>
                <p className="font-body text-base text-muted-foreground leading-relaxed mb-6 flex-1">
                  Every major body system. Tissue state assessment. Integrated Materia Medica. Clinical thinking you can actually use. Built for those who want mastery, not just familiarity.
                </p>
                {/* Small herb accent image */}
                <div className="mb-4 rounded overflow-hidden" style={{ height: "100px" }}>
                  <img src={MORTAR_IMG} alt="Mortar and pestle with herbs" className="w-full h-full object-cover opacity-80" />
                </div>
                <p
                  className="font-serif text-base font-semibold"
                  style={{ color: "hsl(var(--eden-gold))" }}
                >
                  Launching Summer 2026
                </p>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={200}>
            <div className="text-center mt-12">
              <Link to="/why-eden">
                <Button variant="eden" size="xl" className="min-h-[48px] text-sm sm:text-base px-8">
                  Learn More About the Program →
                </Button>
              </Link>
              <p className="mt-4 font-body text-sm text-muted-foreground">
                Enrollment opens June 2026. Course launches July 7, 2026.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* ─── SECTION 4: THE APP ─── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "hsl(var(--eden-sage))" }}>
        {/* Background mortar image */}
        <img
          src={MORTAR_IMG}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.12] mix-blend-luminosity"
        />
        <div className="section-padding-lg relative z-10">
          <div className="eden-container px-6">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <ScrollReveal>
                <div className="text-center md:text-left">
                  <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold mb-6" style={{ color: "hsl(var(--eden-parchment))" }}>
                    Your Apothecary, In Your Pocket
                  </h2>
                  <p className="font-body text-base sm:text-lg max-w-3xl leading-relaxed mb-8" style={{ color: "hsl(var(--eden-parchment) / 0.9)" }}>
                    The Eden Apothecary app is launching alongside the course this summer. A personal herbal reference tool built on the same constitutional and terrain-based framework you'll learn in the program. Look up herbs by body system, tissue state, or constitution — and know exactly why they work for you.
                  </p>
                  <p className="font-serif text-lg font-semibold" style={{ color: "hsl(var(--eden-gold))" }}>
                    Coming Summer 2026
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={200}>
                <div className="flex justify-center">
                  <img
                    src={MORTAR_IMG}
                    alt="Mortar and pestle with fresh herbs"
                    className="w-full max-w-sm h-64 md:h-80 object-cover rounded-lg shadow-2xl"
                    style={{ border: "2px solid hsl(var(--eden-gold) / 0.3)" }}
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      <GoldDivider />

      {/* ─── SECTION 5: BOTTOM CTA ─── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        {/* Atmospheric background image */}
        <img
          src={HERO_IMG}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.12]"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--eden-forest) / 0.9), hsl(var(--eden-forest) / 0.85))" }} />
        <div className="section-padding-lg relative z-10">
          <div className="eden-container text-center px-6">
            <ScrollReveal>
              <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold mb-4" style={{ color: "hsl(var(--eden-parchment))" }}>
                Start With Your Constitution
              </h2>
              <p className="font-body text-lg md:text-xl mb-10" style={{ color: "hsl(var(--eden-parchment) / 0.85)" }}>
                It takes 2 minutes. And it changes how you think about every herb you'll ever use.
              </p>

              <Button
                variant="eden"
                size="xl"
                className="min-h-[48px] text-sm sm:text-base px-4 sm:px-8 max-w-[90vw] whitespace-normal leading-snug"
                onClick={openQuiz}
                style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}
              >
                Take the Free Constitutional Quiz
              </Button>
            </ScrollReveal>

            {/* Social links */}
            <div className="flex items-center justify-center gap-5 mt-10">
              <a
                href="https://www.facebook.com/share/1CRzWj7wmz/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-80"
                style={{ color: "hsl(var(--eden-parchment) / 0.6)" }}
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com/the_eden_institute"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-80"
                style={{ color: "hsl(var(--eden-parchment) / 0.6)" }}
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://pin.it/6AuiXypgA"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-80"
                style={{ color: "hsl(var(--eden-parchment) / 0.6)" }}
                aria-label="Pinterest"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
                </svg>
              </a>
            </div>

            <p className="mt-8 font-body text-xs" style={{ color: "hsl(var(--eden-parchment) / 0.4)" }}>
              The Eden Institute — Biblical Clinical Herbalism Education | edeninstitute.health
            </p>
          </div>
        </div>
      </section>

      <Footer />

      <AssessmentModal open={assessmentModal} onOpenChange={setAssessmentModal} />
    </main>
  );
};

export default Index;
