import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import AssessmentModal from "@/components/landing/AssessmentModal";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { GoldDivider } from "@/components/landing/BotanicalAccents";

const HERO_IMG = "https://images.unsplash.com/photo-1771128264855-1c032332cbc8?auto=format&fit=crop&w=1920&q=80";
const HERBS_SHELF_IMG = "https://images.unsplash.com/photo-1580116270858-8a0d62b15426?auto=format&fit=crop&w=1200&q=80";

const comparisonData = [
  { eden: "Constitutional framework", other: "Symptom-matching" },
  { eden: "Clinical tissue-state theory", other: '"Try this herb for that"' },
  { eden: "Biblically anchored worldview", other: "New Age or secular framing" },
  { eden: "Safety + scope training", other: "No boundaries taught" },
  { eden: "Sequenced 3-tier curriculum", other: "One-off classes" },
  { eden: "Personalized to your body type", other: "One-size-fits-all" },
];

const WhyEden = () => {
  const [assessmentModal, setAssessmentModal] = useState(false);

  useEffect(() => {
    document.title = "Why Eden — The Eden Institute";
    document.querySelector('meta[name="description"]')?.setAttribute("content", "A terrain-based, constitutional herbalism education rooted in Scripture. Learn why The Eden Institute is different.");
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* NAV BAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b" style={{ backgroundColor: "hsla(40, 40%, 97%, 0.95)", borderColor: "hsl(var(--eden-gold) / 0.2)" }}>
        <div className="eden-container flex items-center justify-between py-3 px-6">
          <Link to="/" className="font-serif text-lg font-semibold" style={{ color: "hsl(var(--eden-forest))" }}>
            The Eden Institute
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="font-body text-sm hover:opacity-80 transition-colors hidden sm:inline" style={{ color: "hsl(var(--eden-forest))" }}>
              Home
            </Link>
            <Link to="/why-eden" className="font-body text-sm font-semibold hidden sm:inline" style={{ color: "hsl(var(--eden-gold))" }}>
              Why Eden
            </Link>
            <button
              onClick={() => setAssessmentModal(true)}
              className="!inline-block !w-auto font-body text-sm font-semibold px-4 py-1.5 rounded transition-all hover:opacity-90"
              style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}
            >
              Free Quiz
            </button>
          </div>
        </div>
      </nav>

      {/* SECTION 1: HERO */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <img
          src={HERO_IMG}
          alt="Rustic apothecary with dried herbs"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsla(40, 33%, 93%, 0.88) 0%, hsla(40, 33%, 93%, 0.82) 60%, hsla(40, 33%, 93%, 0.92) 100%)" }} />
        <div className="relative z-10 eden-container text-center max-w-4xl mx-auto px-6 pt-28 pb-20 md:pt-36 md:pb-28">
          <ScrollReveal>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4" style={{ color: "hsl(var(--eden-bark))" }}>
              Most herbalism courses teach you about herbs.
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold mb-8" style={{ color: "hsl(var(--eden-gold))" }}>
              We teach you about YOU.
            </p>
          </ScrollReveal>
          <div className="eden-divider" />
          <ScrollReveal delay={200}>
            <p className="font-body text-base md:text-lg max-w-3xl mx-auto leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.7)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              Because the herb that heals her might wire you. The dose that works for him won't work for you. Herbalism fails when it ignores the most important variable: the body in front of you.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* SECTION 2: THE PROBLEM */}
      <section className="section-padding-lg relative overflow-hidden" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <img src={HERBS_SHELF_IMG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-[0.07] mix-blend-luminosity" />
        <div className="eden-container max-w-4xl mx-auto relative z-10">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-12" style={{ color: "hsl(var(--eden-parchment))" }}>
              Why Herbs Fail Most People
            </h2>
          </ScrollReveal>
          <div className="space-y-6">
            {[
              "They're sold like supplements — take X for Y.",
              "No one explains that your constitution determines your response.",
              'The same "calming herb" can be stimulating for a hot/tense type.',
              "Most courses teach you herb facts. None of them teach you to read your own body first.",
            ].map((item, i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <div className="flex items-start gap-4 pl-4 border-l-2" style={{ borderColor: "hsl(var(--eden-gold))" }}>
                  <p className="text-base md:text-lg leading-relaxed" style={{ color: "hsla(40, 33%, 93%, 0.85)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                    {item}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={300}>
            <p className="text-center mt-12 font-body text-lg italic" style={{ color: "hsl(var(--eden-gold))", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              This isn't herbalism's failure. It's an education gap. And that's exactly what we built The Eden Institute to fix.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* SECTION 3: THE SOLUTION */}
      <section className="section-padding-lg parchment-texture">
        <div className="eden-container max-w-4xl mx-auto">
          <ScrollReveal>
            <p className="font-accent text-sm tracking-[0.3em] uppercase mb-4 text-center" style={{ color: "hsl(var(--eden-gold))" }}>
              The Eden Approach
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground text-center mb-8">
              The Eden Approach
            </h2>
            <div className="eden-divider" />
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed mb-6" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              We teach terrain-based, constitutional herbalism. Before you touch a single herb, you understand your body's pattern — its temperature tendency, fluid state, and tissue tone. Then every herb recommendation is precise, not generic.
            </p>
            <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              This is Western Clinical Herbalism, rooted in 3,000 years of tradition and grounded in Scripture. No chakras. No doshas. No universe worship. Just rigorous plant medicine anchored in the belief that God was intentional in what He made — every body, every plant, every pattern of healing.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* SECTION 4: TIER 1 */}
      <section className="section-padding-lg relative overflow-hidden" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="eden-container max-w-4xl mx-auto relative z-10">
          <ScrollReveal>
            <p className="font-accent text-xs tracking-[0.25em] uppercase mb-3 text-center" style={{ color: "hsl(var(--eden-gold))" }}>
              Tier 1
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10" style={{ color: "hsl(var(--eden-parchment))" }}>
              The Foundations Course
            </h2>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {[
              { label: "Feature", text: "10-lesson Biblical framework course" },
              { label: "Advantage", text: "You learn to read your body's signals before choosing herbs" },
              { label: "Benefit", text: "Herbs stop being guesswork. They become a language." },
            ].map((fab, i) => (
              <ScrollReveal key={fab.label} delay={i * 100}>
                <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "hsl(var(--eden-parchment))", border: "1.5px solid hsl(var(--eden-gold) / 0.4)" }}>
                  <p className="font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>
                    {fab.label}
                  </p>
                  <p className="font-body text-base text-foreground leading-relaxed" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                    {fab.text}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={200}>
            <blockquote className="text-center px-6 py-8">
              <p className="font-accent text-lg md:text-xl italic leading-relaxed mb-3" style={{ color: "hsl(var(--eden-parchment) / 0.9)" }}>
                "Finally understood why lavender made me more anxious — it was wrong for my type."
              </p>
              <footer className="font-body text-sm" style={{ color: "hsl(var(--eden-gold))" }}>
                — Beta Student
              </footer>
            </blockquote>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* SECTION 5: TIER 2 */}
      <section className="section-padding-lg parchment-texture">
        <div className="eden-container max-w-4xl mx-auto">
          <ScrollReveal>
            <p className="font-accent text-xs tracking-[0.25em] uppercase mb-3 text-center" style={{ color: "hsl(var(--eden-gold))" }}>
              Tier 2
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground text-center mb-10">
              Body Systems & Clinical Literacy
            </h2>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { label: "Feature", text: "14 body-system modules with clinical depth" },
              { label: "Advantage", text: "You understand every major system — digestive, hormonal, immune — through a terrain lens" },
              { label: "Benefit", text: "You can help your family the way a trained herbalist would, not a wellness blogger" },
            ].map((fab, i) => (
              <ScrollReveal key={fab.label} delay={i * 100}>
                <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "hsl(var(--eden-cream))", border: "1.5px solid hsl(var(--eden-gold) / 0.4)" }}>
                  <p className="font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>
                    {fab.label}
                  </p>
                  <p className="font-body text-base text-muted-foreground leading-relaxed" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                    {fab.text}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={200}>
            <p className="text-center font-serif text-lg font-semibold" style={{ color: "hsl(var(--eden-gold))" }}>
              Coming 2027
            </p>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* SECTION 6: COMPARISON CHART */}
      <section className="section-padding-lg relative overflow-hidden" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="eden-container max-w-4xl mx-auto relative z-10">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: "hsl(var(--eden-parchment))" }}>
              Eden Institute vs. Generic Herb Courses
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-2 gap-x-4 gap-y-0">
            {/* Header */}
            <div className="pb-4 mb-2 border-b" style={{ borderColor: "hsl(var(--eden-gold) / 0.3)" }}>
              <p className="font-accent text-xs tracking-[0.2em] uppercase font-semibold" style={{ color: "hsl(var(--eden-gold))" }}>
                The Eden Institute
              </p>
            </div>
            <div className="pb-4 mb-2 border-b" style={{ borderColor: "hsl(var(--eden-gold) / 0.3)" }}>
              <p className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Generic Courses
              </p>
            </div>

            {comparisonData.map((row, i) => (
              <ScrollReveal key={i} delay={i * 60} className="contents">
                <div className="flex items-start gap-2 py-3 border-b" style={{ borderColor: "hsl(var(--eden-gold) / 0.1)" }}>
                  <Check className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />
                  <span className="font-body text-sm md:text-base" style={{ color: "hsl(var(--eden-parchment) / 0.9)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                    {row.eden}
                  </span>
                </div>
                <div className="flex items-start gap-2 py-3 border-b" style={{ borderColor: "hsl(var(--eden-gold) / 0.1)" }}>
                  <X className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "hsl(0, 60%, 60%)" }} />
                  <span className="font-body text-sm md:text-base" style={{ color: "hsl(var(--eden-parchment) / 0.5)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                    {row.other}
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <GoldDivider />

      {/* SECTION 7: CREDIBILITY / BUILT ON */}
      <section className="section-padding-lg parchment-texture">
        <div className="eden-container max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <p className="font-accent text-sm tracking-[0.3em] uppercase mb-4" style={{ color: "hsl(var(--eden-gold))" }}>
              Built On
            </p>
            <div className="eden-divider" />
            <div className="space-y-3 mt-8 mb-10">
              {[
                "Western Clinical Herbalism (Eclectic, Physiomedical, Vitalist traditions)",
                "Dr. Sebi's mineral-first nutritional framework",
                "Biblical stewardship medicine",
              ].map((item, i) => (
                <p key={i} className="font-body text-base md:text-lg text-muted-foreground" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                  ✦ {item}
                </p>
              ))}
            </div>
            <p className="font-body text-base italic text-muted-foreground" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              Founded by Camila — herbalist, educator, and founder of The Eden Institute.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* SECTION 8: CTA */}
      <section className="section-padding-lg" style={{ backgroundColor: "hsl(var(--eden-gold))" }}>
        <div className="eden-container max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-4" style={{ color: "hsl(var(--eden-bark))" }}>
              Ready to Understand Your Body?
            </h2>
            <p className="font-body text-lg md:text-xl mb-10 leading-relaxed" style={{ color: "hsl(var(--eden-bark))", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              Start with the free 2-minute quiz to discover your constitutional type — then decide if the course is right for you.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
              <Button
                size="xl"
                className="font-serif font-semibold tracking-wide min-h-[48px]"
                style={{ backgroundColor: "hsl(var(--eden-bark))", borderColor: "hsl(var(--eden-bark))", color: "hsl(var(--eden-gold))" }}
                onClick={() => setAssessmentModal(true)}
              >
                → Take the Free Quiz
              </Button>
              <a href="https://learn.edeninstitute.health/course/back-to-eden1" target="_blank" rel="noopener noreferrer">
                <Button
                  size="xl"
                  variant="outline"
                  className="font-serif font-semibold tracking-wide min-h-[48px] w-full"
                  style={{ backgroundColor: "transparent", borderColor: "hsl(var(--eden-bark))", color: "hsl(var(--eden-bark))" }}
                >
                  → Enroll in the Foundations Course — $197
                </Button>
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <Footer />

      <AssessmentModal open={assessmentModal} onOpenChange={setAssessmentModal} />
    </main>
  );
};

export default WhyEden;
