import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram, ClipboardList, BookOpen, GraduationCap } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import AssessmentModal from "@/components/landing/AssessmentModal";
import { BotanicalLeafTopRight, BotanicalLeafBottomLeft, GoldDivider } from "@/components/landing/BotanicalAccents";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { WorldviewBand } from "@/components/landing/WorldviewBand";
import { WelcomeBackBanner } from "@/components/landing/WelcomeBackBanner";
import { JourneyCTA } from "@/components/journey/JourneyCTA";
import { FOUNDATIONS_COURSE_URL } from "@/hooks/useTierAwareCTA";
import { ROUTES } from "@/lib/routes";

// Unsplash photography
const HERO_IMG = "https://images.unsplash.com/photo-1659328376647-52ec39d1a5cf?auto=format&fit=crop&w=1920&q=80";
const HERBS_SHELF_IMG = "https://images.unsplash.com/photo-1726303238727-1762e3108ed6?auto=format&fit=crop&w=1200&q=80";
const MORTAR_IMG = "https://images.unsplash.com/photo-EHG22u_SIfI?auto=format&fit=crop&w=1200&q=80";

const Index = () => {
  // Local state for the legacy /#assessment hash deep-link → AssessmentModal
  // pathway. JourneyCTA now drives the page's primary action via
  // /assessment route navigation; the modal is preserved only for
  // backwards-compatible inbound links that still target the hash.
  const [assessmentModal, setAssessmentModal] = useState(false);

  // PR β (2026-05-02) — homepage CTA restructure.
  //
  // Predecessor PR #106 had wired 7 scattered Index.tsx CTAs to pivot on
  // hasPattern = !!user && !!pattern. That stopgap is removed here. The
  // page now surfaces ONE dominant next-step CTA via <JourneyCTA />,
  // mounted inside the Hero. JourneyCTA reads the customer-journey state
  // machine in useTierAwareCTA — which itself consults useEdenPattern,
  // and (per PR β's ActiveProfileProvider hoist to App.tsx) resolves the
  // active person_profile's Pattern even on /. Camila's repro of the
  // "Olivia switches to Burning Bowstring on Home" bug is closed by
  // that hoist, not by anything in this file.
  //
  // This page no longer derives `hasPattern` or imports useAuth /
  // useEdenPattern / useTierAwareCTA. The 7 conditional CTAs are gone:
  //   1. Hero conditional Button         → replaced by <JourneyCTA />
  //   2. "For You" section bottom button → removed
  //   3. Path Cards "Quiz/Pattern" card  → removed (grid restructured)
  //   4. "Why Herbs Fail" bottom button  → removed
  //   5. Value-Ladder "Free Quiz" card   → reverted to static info
  //   6. Value-Ladder "$14 Guide" card   → reverted to static info
  //   7. Bottom CTA conditional Button   → removed (heading + body kept)
  //
  // The WelcomeBackBanner above the hero already handles the "you're
  // signed in, here's a one-tap link to your Apothecary" affordance for
  // returning users. JourneyCTA layers the journey progression on top.

  useEffect(() => {
    document.title = "The Eden Institute — Biblical Clinical Herbalism Education";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        "The Eden Institute offers Biblical clinical herbalism education. Take our free body pattern quiz and discover your God-given health pattern.",
      );
  }, []);

  useEffect(() => {
    if (window.location.hash === "#assessment") {
      setAssessmentModal(true);
    }
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />

      {/* §8.1.1 (Manual v4.0) — state-aware welcome strip. Renders only for
          authed users with a resolved Eden Pattern; gives them a one-tap
          path into /apothecary. Anon and authed-without-Pattern visitors
          see nothing here. Per PR β the resolved Pattern reflects the
          active person_profile, not the signed-in user's primary, so
          switching the picker to Olivia surfaces Olivia's Pattern here. */}
      <WelcomeBackBanner />

      {/* ─── SECTION 1: HERO ─── */}
      <section id="hero" className="pt-20 relative overflow-hidden min-h-[90vh] flex items-center">
        <div className="absolute inset-0">
          <img
            src={HERO_IMG}
            alt="Rustic apothecary with dried herbs in glass jars on wooden shelves"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsla(40, 33%, 93%, 0.88) 0%, hsla(40, 33%, 93%, 0.83) 50%, hsla(40, 33%, 93%, 0.93) 100%)",
            }}
          />
        </div>

        <BotanicalLeafTopRight
          className="absolute top-0 right-0 w-48 md:w-72 lg:w-96 h-48 md:h-72 lg:h-96 opacity-[0.08] pointer-events-none"
          style={{ color: "hsl(var(--eden-forest))" }}
        />
        <BotanicalLeafBottomLeft
          className="absolute bottom-0 left-0 w-48 md:w-72 lg:w-96 h-48 md:h-72 lg:h-96 opacity-[0.06] pointer-events-none"
          style={{ color: "hsl(var(--eden-forest))" }}
        />

        <div className="eden-container text-center px-6 relative z-10 py-20 md:py-28">
          <ScrollReveal>
            <h1
              className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-5"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Herbs Work. But Not the Same Way for Everyone.
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p
              className="font-body text-xl sm:text-2xl md:text-3xl mb-10 italic"
              style={{
                color: "hsl(var(--eden-bark) / 0.7)",
                fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif",
              }}
            >
              God designed your body with a specific pattern. Once you know yours, every herb, every protocol, and every decision finally makes sense.
            </p>
          </ScrollReveal>

          <div className="eden-divider" />

          {/* PR β: single dominant next-step CTA + 2 always-visible secondary
              CTAs (Foundations Course always; per-Pattern Amazon kit when
              a Pattern is resolved on the active profile). Replaces the
              prior Hero conditional Button and the "No email required"
              tagline (which JourneyCTA reproduces internally for the
              quiz step). */}
          <ScrollReveal delay={200}>
            <JourneyCTA />
          </ScrollReveal>
        </div>
      </section>

      {/* ─── SOCIAL PROOF STRIP ─── */}
      <section className="py-12 px-6" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <p className="font-accent text-xs tracking-widest uppercase text-center mb-8" style={{ color: "hsl(var(--eden-gold))" }}>
              What Our Students Say
            </p>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ScrollReveal delay={100}>
              <div className="flex flex-col gap-3">
                <p className="font-body text-sm leading-relaxed italic" style={{ color: "hsl(var(--eden-parchment) / 0.9)" }}>
                  "I've taken three herbal courses. This is the first one that treated me like I had a brain. The clinical depth is unlike anything else in this space."
                </p>
                <p className="font-accent text-xs tracking-wide" style={{ color: "hsl(var(--eden-gold))" }}>
                  — Beta Student, Tennessee
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <div className="flex flex-col gap-3">
                <p className="font-body text-sm leading-relaxed italic" style={{ color: "hsl(var(--eden-parchment) / 0.9)" }}>
                  "I finally understand why some herbs work for me and others don't. I wish I had found this ten years ago. My whole family has benefited."
                </p>
                <p className="font-accent text-xs tracking-wide" style={{ color: "hsl(var(--eden-gold))" }}>
                  — Founding Cohort Student
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={300}>
              <div className="flex flex-col gap-3">
                <p className="font-body text-sm leading-relaxed italic" style={{ color: "hsl(var(--eden-parchment) / 0.9)" }}>
                  "As a homeschool mom I needed something I could learn from AND eventually teach my kids. Eden Institute is exactly that. Scripture-anchored and clinically serious."
                </p>
                <p className="font-accent text-xs tracking-wide" style={{ color: "hsl(var(--eden-gold))" }}>
                  — Homeschool Parent, Founding Cohort
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── FOUNDER SECTION ─── */}
      <section className="section-padding-lg" style={{ backgroundColor: "hsl(var(--eden-parchment))" }}>
        <div className="eden-container px-6">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <p className="font-accent text-xs tracking-widest uppercase mb-4" style={{ color: "hsl(var(--eden-gold))" }}>
                From the Founder
              </p>
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6" style={{ color: "hsl(var(--eden-forest))" }}>
                This Education Should Have Existed Already.
              </h2>
              <p className="font-body text-base leading-relaxed mb-6" style={{ color: "hsl(var(--eden-bark) / 0.85)" }}>
                I'm Camila — a Master's-level educator, credentialed teacher, and herbalism practitioner based in Clarksville, Tennessee. I built Eden Institute because I couldn't find a single Biblical herbalism program that was both clinically rigorous and completely free from Eastern spiritual frameworks.
              </p>
              <p className="font-body text-base leading-relaxed mb-6" style={{ color: "hsl(var(--eden-bark) / 0.85)" }}>
                Everything I found was either too shallow, too secular, or quietly rooted in philosophies I don't share. So I built what I needed — and what I believe you've been looking for too. A structured, academically serious, Scripture-anchored education in terrain-based clinical herbalism. Built for the Christian family. Built to last.
              </p>
              <p className="font-body text-base leading-relaxed italic" style={{ color: "hsl(var(--eden-forest))" }}>
                "Yahweh is the ultimate healer. The plants were His idea first."
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── WORLDVIEW BAND (Manual v3.17 Lock #14 + #44 — the source-of-vital-force thesis) ─── */}
      <WorldviewBand />

      {/* ─── FOR YOU SECTION ─── */}
      <section className="section-padding-lg" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="eden-container px-6">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-center mb-4" style={{ color: "hsl(var(--eden-forest))" }}>
                This Is for You If...
              </h2>
              <div className="eden-divider mb-10" />
            </ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                "You've tried herbs but can't figure out why they work for your friend and not for you.",
                "You want to be the health authority in your home — not dependent on a system that doesn't know your family.",
                "You're homeschooling and want your children to grow up understanding how God designed their bodies.",
                "You've looked at other herbal programs and found chakras, doshas, or moon cycles buried inside them.",
                "You believe Yahweh is the ultimate healer and want an education that starts there — not as an afterthought.",
                "You're done with weekend certifications and Pinterest recipes. You want to actually understand the terrain."
              ].map((item, i) => (
                <ScrollReveal key={i} delay={i * 80}>
                  <div className="flex items-start gap-4 p-5 rounded-sm" style={{ backgroundColor: "hsl(var(--eden-parchment))", border: "1px solid hsl(var(--eden-gold) / 0.25)" }}>
                    <span className="font-serif text-xl mt-0.5 shrink-0" style={{ color: "hsl(var(--eden-gold))" }}>✦</span>
                    <p className="font-body text-sm leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.85)" }}>{item}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            {/* PR β: section-end conditional CTA removed. JourneyCTA at the
                top of the page is the dominant action; trailing acquisition
                buttons add visual clutter without doing more conversion
                work. */}
          </div>
        </div>
      </section>

      {/* ─── BANNER: What Makes Us Different ─── */}
      <section className="py-5 md:py-6 px-6" style={{ backgroundColor: "hsl(var(--eden-gold))" }}>
        <div className="eden-container">
          <Link to={ROUTES.WHY_EDEN} className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 group text-center">
            <span
              className="font-serif text-base sm:text-lg md:text-xl font-semibold tracking-wide"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              No Eastern philosophy. No supplement stacks. No weekend certifications. Just Scripture, science, and your body's actual design.
            </span>
            <span
              className="font-serif text-sm sm:text-base font-semibold whitespace-nowrap transition-transform group-hover:translate-x-1 group-hover:underline underline-offset-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              See How We're Different →
            </span>
          </Link>
        </div>
      </section>

      {/* ─── PATH CARDS SECTION ───
          PR β: removed the 4th "Quiz/Pattern" card — it was one of the
          7 hasPattern-pivoted CTAs and is replaced by JourneyCTA at the
          top of the page. Heading rephrased "Four Ways In" → "Three
          Ways In" and the grid restructured from 2-up to 3-up so the
          remaining cards lay out evenly on desktop. */}
      <section className="section-padding-lg" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="eden-container px-6">
          <ScrollReveal>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-center mb-4" style={{ color: "hsl(var(--eden-forest))" }}>
              One Vision. Three Ways In.
            </h2>
            <p className="font-body text-center text-base mb-12" style={{ color: "hsl(var(--eden-bark) / 0.7)" }}>
              Every path leads to the same foundation — Yahweh as the ultimate healer, your body as His design.
            </p>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">

            {/* Card 1 — Tier 1 */}
            <ScrollReveal delay={100}>
              <a href={FOUNDATIONS_COURSE_URL} target="_blank" rel="noopener noreferrer"
                className="block rounded-sm border p-8 hover:shadow-md transition-shadow duration-300 h-full"
                style={{ backgroundColor: "hsl(var(--eden-parchment))", borderColor: "hsl(var(--eden-gold) / 0.3)" }}>
                <BookOpen className="mb-4 w-7 h-7" style={{ color: "hsl(var(--eden-gold))" }} />
                <h3 className="font-serif text-xl font-bold mb-2" style={{ color: "hsl(var(--eden-forest))" }}>
                  Biblical Foundations
                </h3>
                <p className="font-accent text-xs tracking-widest uppercase mb-3" style={{ color: "hsl(var(--eden-gold))" }}>
                  Tier 1 · Now Enrolling
                </p>
                <p className="font-body text-sm leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.8)" }}>
                  The foundation every Christian herbalist needs. Ten lessons covering Biblical health theology, your body's terrain, and how God designed provision in the plant world. This is where everything starts.
                </p>
                <p className="font-body text-sm font-semibold mt-6" style={{ color: "hsl(var(--eden-forest))" }}>
                  Enroll now →
                </p>
              </a>
            </ScrollReveal>

            {/* Card 2 — Tier 2 */}
            <ScrollReveal delay={200}>
              <div className="block rounded-sm border p-8 h-full"
                style={{ backgroundColor: "hsl(var(--eden-parchment))", borderColor: "hsl(var(--eden-gold) / 0.3)", opacity: 0.75 }}>
                <GraduationCap className="mb-4 w-7 h-7" style={{ color: "hsl(var(--eden-gold))" }} />
                <h3 className="font-serif text-xl font-bold mb-2" style={{ color: "hsl(var(--eden-forest))" }}>
                  Body Systems & Clinical Literacy
                </h3>
                <p className="font-accent text-xs tracking-widest uppercase mb-3" style={{ color: "hsl(var(--eden-gold))" }}>
                  Tier 2 · Coming Fall 2026
                </p>
                <p className="font-body text-sm leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.8)" }}>
                  Go clinical. 14 modules. 127 lessons. Every major body system studied through a terrain lens with Scripture as the anchor. This is where students stop dabbling and start practicing.
                </p>
                {/* CTA cleanup 2026-04-30: was ROUTES.COURSES, which sent the user to the
                    courses overview page rather than the dedicated Tier 2 launch waitlist
                    where the $497 founding code is captured. Label promises "waitlist";
                    destination must be the actual waitlist. */}
                <Link to={ROUTES.TIER_TWO_WAITLIST} className="font-body text-sm font-semibold mt-6 block" style={{ color: "hsl(var(--eden-forest))" }}>
                  Join the Waitlist →
                </Link>
              </div>
            </ScrollReveal>

            {/* Card 3 — Homeschool */}
            <ScrollReveal delay={300}>
              <Link to={ROUTES.HOMESCHOOL}
                className="block rounded-sm border p-8 hover:shadow-md transition-shadow duration-300 h-full"
                style={{ backgroundColor: "hsl(var(--eden-parchment))", borderColor: "hsl(var(--eden-gold) / 0.3)" }}>
                <ClipboardList className="mb-4 w-7 h-7" style={{ color: "hsl(var(--eden-gold))" }} />
                <h3 className="font-serif text-xl font-bold mb-2" style={{ color: "hsl(var(--eden-forest))" }}>
                  Eden's Table Curriculum
                </h3>
                <p className="font-accent text-xs tracking-widest uppercase mb-3" style={{ color: "hsl(var(--eden-gold))" }}>
                  K–12 Homeschool · Early Access
                </p>
                <p className="font-body text-sm leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.8)" }}>
                  K–12 curriculum that turns your kitchen into a classroom. Memory songs, hands-on herb labs, Scripture at every turn. Open-and-go. Built for the family that wants to pass this down.
                </p>
                <p className="font-body text-sm font-semibold mt-6" style={{ color: "hsl(var(--eden-forest))" }}>
                  Join the waitlist →
                </p>
              </Link>
            </ScrollReveal>

          </div>
        </div>
      </section>

      <GoldDivider />

      {/* ─── WHY HERBS FAIL SECTION ─── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <img
          src={HERBS_SHELF_IMG}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.08] mix-blend-luminosity"
        />
        <div className="section-padding-lg relative z-10">
          <div className="eden-container px-6">
            <ScrollReveal>
              <h2
                className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-14"
                style={{ color: "hsl(var(--eden-parchment))" }}
              >
                Why Herbs Fail Most People
              </h2>
            </ScrollReveal>

            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {[
                {
                  title: "Wrong herb for your body",
                  body: "You picked an herb based on a blog post or a friend's recommendation. But her body runs hot and yours runs cold — the same herb does opposite things.",
                },
                {
                  title: "Wrong dose at the wrong time",
                  body: "You used the right herb but the wrong preparation, the wrong amount, or at the wrong point in your cycle. Timing and dosing depend on your body pattern.",
                },
                {
                  title: "You expected it to work like a drug",
                  body: "Herbs don't suppress symptoms. They support terrain. When you treat your body like a machine that needs a quick fix, herbs will always disappoint.",
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
                    <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-4">{card.title}</h3>
                    <p className="font-body text-base text-muted-foreground leading-relaxed">{card.body}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={200}>
              <p
                className="text-center mt-12 font-body text-lg italic"
                style={{
                  color: "hsl(var(--eden-parchment) / 0.85)",
                  fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif",
                }}
              >
                None of that is your fault. You were never taught to read your own terrain.
              </p>
            </ScrollReveal>

            {/* PR β: section-end conditional CTA removed. JourneyCTA at
                the top of the page is the dominant action. */}
          </div>
        </div>
      </section>

      <GoldDivider />

      {/* ─── CREDIBILITY STRIP ─── */}
      <section className="py-10 md:py-12 px-6" style={{ backgroundColor: "hsl(var(--eden-sage) / 0.15)" }}>
        <div className="eden-container">
          <ScrollReveal>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-center">
              <span
                className="font-accent text-sm md:text-base tracking-wide"
                style={{ color: "hsl(var(--eden-forest))" }}
              >
                Built on 3,000 years of Western clinical herbalism tradition
              </span>
              <span className="hidden md:inline font-serif text-lg" style={{ color: "hsl(var(--eden-gold))" }}>
                ·
              </span>
              <span
                className="font-accent text-sm md:text-base tracking-wide"
                style={{ color: "hsl(var(--eden-forest))" }}
              >
                Eclectic · Physiomedical · Vitalist frameworks
              </span>
              <span className="hidden md:inline font-serif text-lg" style={{ color: "hsl(var(--eden-gold))" }}>
                ·
              </span>
              <span
                className="font-accent text-sm md:text-base tracking-wide"
                style={{ color: "hsl(var(--eden-forest))" }}
              >
                Rooted in Scripture. Free from Eastern metaphysics.
              </span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* ─── VALUE LADDER SECTION ───
          PR β: cards 1 & 2 reverted to static informational divs (no
          Link/button wrappers, no onClick / hasPattern pivots). They
          show the journey progression visually — Free quiz → $14 guide
          → $97 course — but the dominant action lives in JourneyCTA at
          the top of the page. Card 3 (Foundations Course) keeps its
          external link to LearnWorlds. */}
      <section className="section-padding-lg parchment-texture relative overflow-hidden">
        <div className="eden-container px-6 relative z-10">
          <ScrollReveal>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-6">
              Start Free. Go Deep When You're Ready.
            </h2>
            <div className="eden-divider" />
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto mt-12">
            {[
              {
                icon: <ClipboardList className="w-10 h-10" style={{ color: "hsl(var(--eden-gold))" }} />,
                label: "Free Quiz",
                description: "Discover your body pattern in 2 minutes",
                price: "FREE",
                href: null as string | null,
                external: false,
                ariaLabel: undefined as string | undefined,
              },
              {
                icon: <BookOpen className="w-10 h-10" style={{ color: "hsl(var(--eden-gold))" }} />,
                label: "Deep-Dive Guide",
                description: "Your personalized herb guide — 10 matched herbs, nutrition, lifestyle, and Scripture",
                price: "$14",
                href: null as string | null,
                external: false,
                ariaLabel: undefined as string | undefined,
              },
              {
                icon: <GraduationCap className="w-10 h-10" style={{ color: "hsl(var(--eden-gold))" }} />,
                label: "Foundations Course",
                description: "Learn to read your body pattern and match it to God's provision in the plant world",
                price: "$97",
                href: FOUNDATIONS_COURSE_URL,
                external: true,
                ariaLabel: "Enroll in the Foundations Course",
              },
            ].map((step, i) => {
              const cardInner = (
                <div
                  className="rounded-lg p-6 md:p-8 text-center shadow-md hover:shadow-lg transition-all duration-300 flex flex-col items-center hover:-translate-y-1 h-full"
                  style={{
                    backgroundColor: "hsl(var(--eden-cream))",
                    border: "1.5px solid hsl(var(--eden-gold) / 0.4)",
                  }}
                >
                  {/* Step number */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-serif text-sm font-bold mb-4"
                    style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}
                  >
                    {i + 1}
                  </div>
                  {step.icon}
                  <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mt-4 mb-2">{step.label}</h3>
                  <p className="font-body text-base text-muted-foreground leading-relaxed mb-4 flex-1">
                    {step.description}
                  </p>
                  <p className="font-serif text-2xl font-bold" style={{ color: "hsl(var(--eden-gold))" }}>
                    {step.price}
                  </p>
                </div>
              );

              return (
                <ScrollReveal key={step.label} delay={i * 120}>
                  {step.href && step.external ? (
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={step.ariaLabel}
                      className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--eden-gold))] rounded-lg"
                    >
                      {cardInner}
                    </a>
                  ) : (
                    // Static informational card. The dominant action lives
                    // in JourneyCTA at the top of the page; these tiles
                    // illustrate the value-ladder progression but are not
                    // themselves CTAs.
                    <div className="block h-full">{cardInner}</div>
                  )}
                </ScrollReveal>
              );
            })}
          </div>

          <ScrollReveal delay={200}>
            <p
              className="text-center mt-10 font-body text-lg italic text-muted-foreground"
              style={{ fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}
            >
              No pressure. No upsells. Just a clear path from curious to clinically literate.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* ─── THE COURSE ─── */}
      <section
        id="course"
        className="section-padding-lg relative overflow-hidden"
        style={{ backgroundColor: "hsl(var(--eden-sage))" }}
      >
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
                  <h2
                    className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
                    style={{ color: "hsl(var(--eden-parchment))" }}
                  >
                    A Real Education in Biblical Clinical Herbalism
                  </h2>
                  <p
                    className="font-body text-base sm:text-lg max-w-3xl leading-relaxed mb-8"
                    style={{ color: "hsl(var(--eden-parchment) / 0.9)" }}
                  >
                    The Eden Institute is a structured, three-tier clinical herbalism program anchored in Scripture and
                    built with academic rigor. We don't sell supplement stacks or weekend certifications. We teach you
                    to read the body, understand the terrain, and match the person to the plant.
                  </p>
                  <Link to={ROUTES.WHY_EDEN}>
                    <Button variant="eden" size="xl" className="min-h-[48px] text-sm sm:text-base px-8">
                      Learn More About the Program →
                    </Button>
                  </Link>
                  <p className="mt-4 font-body text-sm" style={{ color: "hsl(var(--eden-parchment) / 0.7)" }}>
                    Enrollment opens June 2026. Course launches July 7, 2026.
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

      {/* ─── BOTTOM CTA ───
          PR β: conditional Button removed. The closing heading + body
          remain as a sectional sign-off, but the dominant action lives
          in JourneyCTA at the top of the page so we don't repeat it
          here. Social links preserved. */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <img
          src={HERO_IMG}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.12]"
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, hsl(var(--eden-forest) / 0.9), hsl(var(--eden-forest) / 0.85))",
          }}
        />
        <div className="section-padding-lg relative z-10">
          <div className="eden-container text-center px-6">
            <ScrollReveal>
              <h2
                className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
                style={{ color: "hsl(var(--eden-parchment))" }}
              >
                Two Minutes Could Change How You Use Herbs Forever.
              </h2>
              <p className="font-body text-lg md:text-xl mb-2" style={{ color: "hsl(var(--eden-parchment) / 0.85)" }}>
                It takes 2 minutes. And it changes how you think about every herb you'll ever use.
              </p>
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
