import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import WaitlistModal from "@/components/landing/WaitlistModal";
import AssessmentModal from "@/components/landing/AssessmentModal";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { GoldDivider } from "@/components/landing/BotanicalAccents";

const APP_AUDIENCE_ID = "cebd2478-b344-41b7-98c8-8bcf0e0108da";

const HERO_IMG = "https://images.unsplash.com/photo-1771128264855-1c032332cbc8?auto=format&fit=crop&w=1920&q=80";
const HERBS_SHELF_IMG = "https://images.unsplash.com/photo-1580116270858-8a0d62b15426?auto=format&fit=crop&w=1200&q=80";
const MORTAR_IMG = "https://images.unsplash.com/photo-1492552085122-36706c238263?auto=format&fit=crop&w=1200&q=80";
const HERBS_TABLE_IMG = "https://images.unsplash.com/photo-1726996155615-e986ed87c9d4?auto=format&fit=crop&w=1200&q=80";

const differentiators = [
  {
    num: 1,
    title: "We Honor the Creator, Not Creation",
    body: "Every other program teaches you to honor the earth, the moon, the stars, 'the universe.' None of them name the One who made it all. We don't worship creation. We study it — under the authority of the Creator. Plants are not magic. They are medicine with a Maker.",
  },
  {
    num: 2,
    title: "We Teach Constitutions, Not Symptoms",
    body: "God didn't make every body the same — so why would every remedy be the same? We teach constitutional assessment: how to read the unique pattern God designed into each person, and match it to the plant He designed to meet it. This is herbalism as precision, not guesswork.",
  },
  {
    num: 3,
    title: "We Build Clinical Literacy, Not Product Dependency",
    body: "The wellness industry gave you products instead of principles and called it empowerment. Real empowerment is literacy — knowing what your body is doing and why. We don't sell you a supplement stack. We teach you to read terrain, assess tissue states, and make grounded decisions.",
  },
  {
    num: 4,
    title: "This Is a Three-Tier Clinical Program",
    body: "This isn't a weekend workshop. It's a structured, sequential education:\n— Tier 1: Biblical Foundations of Herbalism (10 lessons)\n— Tier 2: Body Systems & Clinical Literacy (14 chapters, textbook-level depth)\n— Tier 3: Terrain-Based Clinical Herbalism (mentorship-level, coming soon)\nBuilt with academic rigor. Designed for women who want mastery.",
  },
  {
    num: 5,
    title: "Stewardship as Worship",
    body: "We reframe health from survival to stewardship. God gave you a body, a garden, and a mind to learn with. Faithful stewardship is educated stewardship. That's not works — it's worship. Health stops being an emergency and starts being a discipline.",
  },
  {
    num: 6,
    title: "Faith Over Fear in Health Decisions",
    body: "Fear says 'What if it gets worse?' Faith says 'God gave me a body that knows what to do.' We teach you to make health decisions from faith — grounded in understanding, not panic. You were not given a spirit of fear. You were given power, love, and a sound mind (2 Timothy 1:7).",
  },
  {
    num: 7,
    title: "We Reclaim a Christian Heritage",
    body: "Someone told you herbs were witchcraft. And it scared you away from something God planted with His own hands. The first garden was His. The Church practiced plant medicine for centuries — then forgot. We're here to help you remember. This is your heritage.",
  },
  {
    num: 8,
    title: "Formation, Not Just Information",
    body: "You don't need another detox. You don't need another influencer's protocol. You need to understand your own body — how it eliminates, circulates, regulates, and heals. When you understand the terrain, you stop chasing trends and start making decisions. We teach formation.",
  },
  {
    num: 9,
    title: "Generational Wisdom, Restored",
    body: "Your grandmother didn't Google it. She walked outside. She knew which root to pull, which leaf to steep, which bark to simmer. That chain of generational wisdom was broken — not by accident, but by design. The Eden Institute exists to reconnect it. For you, and for your children.",
  },
];

const forYou = [
  "You believe God designed the body and the garden with intention",
  "You want clinical depth, not surface-level wellness content",
  "You've felt out of place in herbalism programs that center Eastern spirituality",
  "You want to understand WHY an herb works, not just memorize WHICH herb to take",
  "You're a mother, educator, or aspiring practitioner who wants real training",
  "You're ready to steward your family's health with knowledge, not fear",
];

const notForYou = [
  "You want a quick-fix herb list or a weekend certification",
  "You're looking for programs rooted in chakra work, moon cycles, or \"universe\" spirituality",
  "You want someone to tell you what to take without understanding why",
  "You're not willing to study — this is real coursework with real depth",
];

const WhyEden = () => {
  const [waitlistModal, setWaitlistModal] = useState(false);
  const [assessmentModal, setAssessmentModal] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToCourse = () => {
    document.getElementById("course-overview")?.scrollIntoView({ behavior: "smooth" });
  };

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
              className="font-body text-sm font-semibold px-4 py-1.5 rounded transition-all hover:opacity-90"
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
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsla(40, 33%, 93%, 0.85) 0%, hsla(40, 33%, 93%, 0.8) 60%, hsla(40, 33%, 93%, 0.9) 100%)" }} />
        <div className="relative z-10 eden-container text-center max-w-4xl mx-auto px-6 pt-28 pb-20 md:pt-36 md:pb-28">
          <ScrollReveal>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6" style={{ color: "hsl(var(--eden-bark))" }}>
              This Isn't Another Herbalism Course.
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p className="font-body text-xl md:text-2xl italic mb-8" style={{ color: "hsl(var(--eden-bark) / 0.7)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              It's the one that should have existed all along.
            </p>
          </ScrollReveal>
          <div className="eden-divider" />
          <ScrollReveal delay={200}>
            <p className="font-body text-base md:text-lg max-w-3xl mx-auto mb-10 leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.65)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              Most herbalism programs teach you what to take. We teach you <em>how to think</em>. The Eden Institute is a three-tier clinical herbalism education anchored in Scripture, built with academic rigor, and designed for women who want depth — not decoration.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={300}>
            <Button variant="eden" size="xl" onClick={scrollToCourse}>
              → Explore the Program
            </Button>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* SECTION 2: THE PROBLEM */}
      <section className="section-padding-lg relative overflow-hidden" style={{ backgroundColor: "#2C3E2D" }}>
        <img src={HERBS_SHELF_IMG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-[0.07] mix-blend-luminosity" />
        <div className="eden-container max-w-5xl mx-auto relative z-10">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-12 md:mb-16" style={{ color: "#F5F0E8" }}>
              You've Tried the Herbs. You've Bought the Supplements.{" "}
              <span className="block mt-1">You've Followed the Protocols.</span>
            </h2>
          </ScrollReveal>
          <div className="grid gap-8 md:gap-10">
            {[
              {
                title: "The Pill-Swapping Trap",
                body: "Most herbalism education — and most of the wellness industry — teaches you to swap a pharmaceutical pill for an herbal pill. Take this for that. But that's not herbalism. That's allopathy in a green wrapper. When it doesn't work, you blame the herb. But the herb was never the problem. The approach was.",
              },
              {
                title: "The Worldview Gap",
                body: "You wanted to learn herbalism, but every program you found was wrapped in language you couldn't sit under. Moon rituals. Chakra work. 'The universe.' You believe in an intelligent Designer — and you shouldn't have to check your faith at the door to learn what He made.",
              },
              {
                title: "The Depth Gap",
                body: "You're tired of surface-level content. Weekend workshops. PDFs and prayers. '10 herbs every mom should know.' You don't want a recipe list. You want to actually understand how the body works, why it breaks down, and how God designed it to heal.",
              },
            ].map((problem, i) => (
              <ScrollReveal key={i} delay={i * 100}>
                <div className="border-l-2 pl-6 md:pl-8" style={{ borderColor: "#C5A44E" }}>
                  <h3 className="font-serif text-xl md:text-2xl font-semibold mb-3" style={{ color: "#C5A44E" }}>
                    {problem.title}
                  </h3>
                  <p className="text-base md:text-lg leading-relaxed" style={{ color: "rgba(245, 240, 232, 0.8)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                    {problem.body}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Botanical accent image between sections */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img src={MORTAR_IMG} alt="Herbs being prepared with mortar and pestle" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #2C3E2D 0%, transparent 30%, transparent 70%, hsl(var(--eden-parchment)) 100%)" }} />
      </div>

      {/* SECTION 3: NINE DIFFERENTIATORS */}
      <section className="section-padding-lg parchment-texture">
        <div className="eden-container max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12 md:mb-20">
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground leading-tight">
                Nine Things That Set The Eden Institute Apart
              </h2>
              <div className="eden-divider" />
            </div>
          </ScrollReveal>
          <div className="grid gap-6 md:gap-8">
            {differentiators.map((d, i) => (
              <ScrollReveal key={d.num} delay={Math.min(i * 60, 300)}>
                <div
                  className="relative rounded-lg p-6 md:p-8 pl-8 md:pl-10 shadow-sm hover:shadow-md transition-shadow"
                  style={{ backgroundColor: "hsl(var(--eden-cream))", borderLeft: "4px solid #C5A44E", border: "1px solid hsl(var(--eden-gold) / 0.2)", borderLeftWidth: "4px", borderLeftColor: "#C5A44E" }}
                >
                  <div className="flex items-start gap-4 md:gap-6">
                    <span
                      className="font-serif text-3xl md:text-4xl font-bold leading-none shrink-0"
                      style={{ color: "#C5A44E" }}
                    >
                      {d.num}
                    </span>
                    <div>
                      <h3 className="font-serif text-lg md:text-xl font-semibold text-foreground mb-2">
                        {d.title}
                      </h3>
                      <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-line" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                        {d.body}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Botanical accent image */}
      <div className="relative h-48 md:h-56 overflow-hidden">
        <img src={HERBS_TABLE_IMG} alt="Fresh botanical herbs on a rustic surface" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--eden-parchment)) 0%, transparent 30%, transparent 70%, #5C7A5C 100%)" }} />
      </div>

      {/* SECTION 4: COURSE OVERVIEW */}
      <section id="course-overview" className="section-padding-lg relative overflow-hidden" style={{ backgroundColor: "#5C7A5C" }}>
        <img src={HERBS_SHELF_IMG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-[0.08] mix-blend-luminosity" />
        <div className="eden-container max-w-5xl mx-auto relative z-10">
          <ScrollReveal>
            <div className="text-center mb-12 md:mb-16">
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold leading-tight" style={{ color: "#F5F0E8" }}>
                Two Tiers. One Foundation. Real Depth.
              </h2>
              <div className="eden-divider" />
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-8 md:gap-10">
            {/* Tier 1 */}
            <ScrollReveal delay={0}>
              <div className="rounded-lg p-8 md:p-10 shadow-lg" style={{ backgroundColor: "#F5F0E8", border: "1.5px solid hsl(var(--eden-gold) / 0.4)" }}>
                <p className="font-accent text-xs tracking-[0.25em] uppercase mb-3 font-semibold" style={{ color: "#C5A44E" }}>
                  Tier 1
                </p>
                <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-6">
                  Back to Eden: Foundations of Biblical Herbalism
                </h3>
                <ul className="space-y-3 mb-8" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                  {[
                    "10 video lessons across 3 parts",
                    "Constitutional assessment framework",
                    "Terrain-based thinking introduced",
                    "The Five Tenets of Health: Nutrition, Elimination, Circulation, Nervous Regulation, Structure",
                    "Biblical theology of healing woven throughout",
                    "Companion worksheets, quizzes, and a Sensory Exploration Guide",
                    "Certificate of Completion",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground text-base">
                      <span className="mt-1 shrink-0" style={{ color: "#C5A44E" }}>✦</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="font-serif text-2xl font-bold text-foreground mb-1">$197</p>
                <p className="font-body text-sm text-muted-foreground">Payment plans available</p>
              </div>
            </ScrollReveal>
            {/* Tier 2 */}
            <ScrollReveal delay={150}>
              <div className="rounded-lg p-8 md:p-10 shadow-lg" style={{ backgroundColor: "#F5F0E8", border: "1.5px solid hsl(var(--eden-gold) / 0.4)" }}>
                <p className="font-accent text-xs tracking-[0.25em] uppercase mb-3 font-semibold" style={{ color: "#C5A44E" }}>
                  Tier 2
                </p>
                <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-6">
                  Back to Eden: Body Systems &amp; Clinical Literacy
                </h3>
                <ul className="space-y-3 mb-8" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                  {[
                    "14 chapters of textbook-level clinical education",
                    "Every major body system — from hepatobiliary to reproductive",
                    "Tissue state assessment across each system",
                    "Materia Medica integrated into every chapter",
                    "Dr. Sebi's alkaline framework incorporated",
                    "Designed to build real clinical thinking",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground text-base">
                      <span className="mt-1 shrink-0" style={{ color: "#C5A44E" }}>✦</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="font-serif text-xl font-bold" style={{ color: "#C5A44E" }}>Coming Summer 2026</p>
              </div>
            </ScrollReveal>
          </div>
          <p className="text-center mt-10 text-base italic" style={{ color: "rgba(245, 240, 232, 0.7)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
            Tier 3 — Terrain-Based Clinical Herbalism — is in development. It will include mentorship-level training and advanced clinical application.
          </p>
          <div className="text-center mt-8">
            <Button variant="eden" size="xl" onClick={() => setWaitlistModal(true)}>
              → Join the Waitlist
            </Button>
          </div>
        </div>
      </section>

      <GoldDivider />

      {/* SECTION 5: THE 2AM MOM */}
      <section className="section-padding-lg parchment-texture">
        <div className="eden-container max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground leading-tight mb-8">
              This Was Built for the Woman at 2AM.
            </h2>
            <div className="eden-divider" />
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              The one Googling symptoms in the dark. The one who doesn't trust the answers she's finding. The one who wants to do better for her family but doesn't know where to start. You were never taught how to think about the body — just how to panic about it. The Eden Institute was built to replace that fear with a framework. So the next time your child has a fever at 2AM, you respond with confidence instead of chaos.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* SECTION 6: WHO THIS IS FOR / NOT FOR */}
      <section className="section-padding-lg bg-background">
        <div className="eden-container max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16">
            <ScrollReveal>
              <div>
                <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-6">
                  This Is For You If…
                </h3>
                <ul className="space-y-4">
                  {forYou.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />
                      <span className="text-muted-foreground text-base leading-relaxed" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <div>
                <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-6">
                  This Is Not For You If…
                </h3>
                <ul className="space-y-4">
                  {notForYou.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <X className="w-5 h-5 text-muted-foreground/50 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground text-base leading-relaxed" style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Botanical accent image */}
      <div className="relative h-48 md:h-56 overflow-hidden">
        <img src={HERBS_SHELF_IMG} alt="Dried herbs and apothecary jars" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--background)) 0%, transparent 30%, transparent 70%, #2C3E2D 100%)" }} />
      </div>

      {/* SECTION 7: THE FOUNDER */}
      <section className="section-padding-lg relative overflow-hidden" style={{ backgroundColor: "#2C3E2D" }}>
        <img src={HERBS_TABLE_IMG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-[0.06] mix-blend-luminosity" />
        <div className="eden-container max-w-3xl mx-auto text-center relative z-10">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-8" style={{ color: "#F5F0E8" }}>
              Built by a Woman Who Couldn't Find the Right Course — So She Created It.
            </h2>
            <div className="eden-divider" />
            <p className="text-base md:text-lg leading-relaxed" style={{ color: "rgba(245, 240, 232, 0.8)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              Camila is the founder of The Eden Institute and a Biblical clinical herbalism educator. After years of studying under programs that required her to set aside her faith to learn what God made, she stopped looking for the right course and started building it. The Eden Institute is the result — a structured, Scripture-anchored, clinically rigorous education for women who refuse to choose between depth and devotion.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* SECTION 8: FINAL CTA */}
      <section className="section-padding-lg" style={{ backgroundColor: "#C5A44E" }}>
        <div className="eden-container max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-4" style={{ color: "#1E1E14" }}>
              Enrollment Opens June 2026. The Course Launches July 7.
            </h2>
            <p className="text-lg md:text-xl mb-10 leading-relaxed" style={{ color: "#1E1E14", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              Join the waitlist. Take the free Constitutional Quiz. And start learning what God planted — before the world buried it.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 mb-10">
              <Button
                size="xl"
                className="font-serif font-semibold tracking-wide"
                style={{ backgroundColor: "#1E1E14", borderColor: "#1E1E14", color: "#C5A44E" }}
                onClick={() => setWaitlistModal(true)}
              >
                → Join the Waitlist
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="font-serif font-semibold tracking-wide"
                style={{ backgroundColor: "transparent", borderColor: "#1E1E14", color: "#1E1E14" }}
                onClick={() => setAssessmentModal(true)}
              >
                → Take the Free Quiz
              </Button>
            </div>
            <p className="text-sm font-semibold mb-6" style={{ color: "#1E1E14", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              The Eden Institute — Biblical Clinical Herbalism Education | edeninstitute.health
            </p>
            <div className="flex items-center justify-center gap-6">
              <a href="https://www.facebook.com/share/1CRzWj7wmz/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity" style={{ color: "#1E1E14" }}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="https://instagram.com/the_eden_institute" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity" style={{ color: "#1E1E14" }}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="https://pin.it/6AuiXypgA" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity" style={{ color: "#1E1E14" }}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <Footer />

      <WaitlistModal
        open={waitlistModal}
        onOpenChange={setWaitlistModal}
        audienceId={APP_AUDIENCE_ID}
        title="Join the Waitlist"
      />
      <AssessmentModal open={assessmentModal} onOpenChange={setAssessmentModal} />
    </main>
  );
};

export default WhyEden;
