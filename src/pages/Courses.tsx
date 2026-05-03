import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle, Clock, GraduationCap, Users } from "lucide-react";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { JourneyAwareQuizCTA } from "@/components/journey/JourneyAwareQuizCTA";
import { useJourneyAwareQuizCTA } from "@/hooks/useJourneyAwareQuizCTA";
import { Button } from "@/components/ui/button";
import { TierTwoWaitlistModal } from "@/components/landing/TierTwoWaitlistModal";
import { ROUTES } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { getAmazonKitUrl } from "@/lib/amazonKitUrls";

const T1 = "https://learn.edeninstitute.health/course/back-to-eden1";

// 2026-05-03 PR (this commit): Eden Foundations book Amazon link.
// Used both by the existing companion-textbook block and as the
// fallback target for the new top+bottom Amazon-Kit CTAs when the
// visitor does not yet have a resolved Pattern (so the affiliate
// revenue path is live for anonymous visitors too). Same affiliate
// tag as amazonKitUrls (mobile088c05e-20).
const EDEN_FOUNDATIONS_BOOK_URL =
  "https://www.amazon.com/dp/B0GPT81RDF?tag=mobile088c05e-20";

const Courses = () => {
  useDocumentMeta({
    title: "Courses — Biblical Clinical Herbalism | The Eden Institute",
    description:
      "A three-tier, faith-rooted curriculum for Christian families — from the biblical foundations of plant medicine through terrain-based clinical herbalism. Tier 1 enrolling now at $97 founding price.",
    canonical: "https://edeninstitute.health/courses",
  });

  // PR η fix #6 (small): the bottom "Not Sure Where to Start?" section's
  // heading + paragraph also pivot when a Pattern is resolved.
  const journeyCta = useJourneyAwareQuizCTA();

  // 2026-05-03 PR: Pattern-aware Amazon Kit CTA. When the visitor
  // has a resolved Pattern, getAmazonKitUrl returns that Pattern's
  // matched Amazon wishlist (8 personalized kits, one per Pattern,
  // affiliate-tagged). When no Pattern, fall back to the Eden
  // Foundations book — never absent on the /courses page per
  // founder direction (revenue surface should always render).
  const { data: activePattern } = useEdenPattern();
  const patternKitUrl = getAmazonKitUrl(activePattern);
  const amazonKitUrl = patternKitUrl ?? EDEN_FOUNDATIONS_BOOK_URL;
  const amazonKitLabel = activePattern
    ? `Get the ${activePattern.replace(/^The\s+/i, "")} Starter Kit`
    : "Get the Eden Foundations Book";
  const amazonKitAriaLabel = `${amazonKitLabel} on Amazon (opens in a new tab)`;

  // PR ι (iota): both Tier 2 waitlist CTAs on this page (the Tier 2 card
  // primary action + the companion textbook block) now open the
  // TierTwoWaitlistModal directly instead of routing to
  // /tier-2-waitlist. Each pair gets a "Learn More" sibling that
  // points at /tier-2-waitlist for visitors who want the full info
  // page before signing up. Single shared state for both because both
  // surfaces submit through the same EF and we want only one modal
  // mounted at a time.
  const [tier2Modal, setTier2Modal] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="px-6 py-20 md:py-28" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-6 font-accent text-sm uppercase tracking-[0.3em]" style={{ color: "hsl(var(--eden-gold))" }}>
            Biblical Clinical Herbalism
          </p>
          <h1 className="mb-6 font-serif text-4xl font-bold leading-tight md:text-5xl lg:text-6xl" style={{ color: "hsl(var(--eden-bark))" }}>
            Learn to Read the Body.
            <br />
            <span className="italic">Match the Plant. Steward the Family.</span>
          </h1>
          <div className="mx-auto my-8 h-px w-16" style={{ backgroundColor: "hsl(var(--eden-gold))" }} />
          <p className="mx-auto mb-10 max-w-2xl font-body text-lg leading-relaxed text-muted-foreground">
            A three-tier, faith-rooted curriculum for Christian families — from the biblical
            foundations of plant medicine through terrain-based clinical herbalism.
          </p>
          <blockquote className="scripture-block mx-auto mb-10 max-w-xl text-left text-sm text-muted-foreground">
            "He causeth the grass to grow for the cattle, and herb for the service of man."
            <footer className="mt-2 font-body text-xs font-medium uppercase tracking-wider not-italic" style={{ color: "hsl(var(--eden-forest))" }}>
              — Psalm 104:14 (KJV)
            </footer>
          </blockquote>
          {/* 2026-05-03 PR: CTA cluster restructured for equal-height
              alignment across all variants. Each <a> wrapper is now
              inline-flex w-full sm:w-auto so it participates as a
              flex item; Button h-full stretches the inner button to
              fill the wrapper. New 3rd button (Amazon Kit) sits to
              the right of the existing two. */}
          <div className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:flex-wrap">
            {/* PR η fix #3: hero Tier 1 CTA reflects the founding price. */}
            <a
              href={T1}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto"
            >
              <Button variant="eden" size="xl" className="w-full h-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] py-3 px-6">
                Enroll in Tier 1 — $97 Founding
              </Button>
            </a>
            <JourneyAwareQuizCTA
              variant="eden-outline"
              size="xl"
              noPatternLabel="Take the Free Quiz First"
              className="w-full sm:w-auto h-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] py-3 px-6"
            />
            {/* 2026-05-03 PR: top-of-page Amazon Kit CTA. Pattern-aware
                with book fallback. Affiliate-tagged via amazonKitUrls
                helper (or the explicit EDEN_FOUNDATIONS_BOOK_URL). */}
            <a
              href={amazonKitUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              aria-label={amazonKitAriaLabel}
              data-cta="courses-hero-amazon-kit"
              className="inline-flex w-full sm:w-auto"
            >
              <Button variant="eden-outline" size="xl" className="w-full h-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] py-3 px-6">
                {amazonKitLabel} →
              </Button>
            </a>
          </div>
          {/* FTC affiliate disclosure — present whenever the Amazon
              CTA is rendered (always on this page). Matches Navbar +
              MatchedHerbsCtaPair wording for cross-surface consistency. */}
          <p className="mt-4 font-body text-[11px] italic text-muted-foreground">
            Amazon links are affiliate links — Eden Institute earns a small commission at no extra cost to you.
          </p>
        </div>
      </section>

      <section className="bg-background px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-serif text-3xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
              Three Tiers. One Coherent Path.
            </h2>
            <p className="mx-auto max-w-2xl font-body text-muted-foreground">
              Each tier builds on the last — from Biblical foundations to clinical practice.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* PR η fix #3: Tier 1 founding pricing. */}
            <div className="relative rounded-lg border-2 p-8" style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}>
              <span className="absolute -top-3 left-6 rounded px-3 py-1 text-xs font-semibold uppercase tracking-widest" style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}>
                Now Enrolling
              </span>
              <BookOpen className="mb-4 h-8 w-8" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="mb-1 font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
                Tier 1 — Biblical Framework
              </h3>
              <p className="my-4 font-body text-sm leading-relaxed text-muted-foreground">
                The theological foundation of plant medicine. Creation-based health, the Five
                Tenets, and your body pattern.
              </p>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--eden-forest))" }} />10 lessons, self-paced</li>
                <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--eden-forest))" }} />Body Pattern Quiz included</li>
                <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--eden-forest))" }} />Certificate of completion</li>
                <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--eden-forest))" }} />Lifetime access</li>
              </ul>
              <p className="mb-1 text-center font-serif text-3xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>$97</p>
              <p className="mb-4 text-center font-body text-xs leading-snug" style={{ color: "hsl(var(--eden-bark) / 0.65)" }}>
                Founding student price · first 100 students · regularly $197
              </p>
              <a href={T1} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="eden" className="w-full">Enroll Now</Button>
              </a>
            </div>

            <div className="mt-8 rounded-sm border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ backgroundColor: "hsl(var(--eden-parchment))", borderColor: "hsl(var(--eden-gold) / 0.4)" }}>
              <div>
                <p className="font-accent text-xs tracking-widest uppercase mb-1" style={{ color: "hsl(var(--eden-gold))" }}>Companion Textbook · Tier 1</p>
                <h3 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-forest))" }}>Back to Eden: Foundations of Biblical Herbalism</h3>
                <p className="font-body text-sm" style={{ color: "hsl(var(--eden-bark) / 0.75)" }}>The print companion to the Tier 1 course. Read it alongside the lessons or give it as a gift to someone beginning their herbal journey.</p>
              </div>
              <a
                href={EDEN_FOUNDATIONS_BOOK_URL}
                target="_blank"
                rel="noopener noreferrer sponsored"
                aria-label="Browse the Eden Institute book series on Amazon (opens in a new tab)"
                className="shrink-0 font-body text-xs tracking-widest uppercase font-semibold px-4 py-2 rounded-sm text-center transition-opacity hover:opacity-90"
                style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}
              >
                Buy the Book
              </a>
            </div>

            {/* PR η fix #3: Tier 2 "Coming 2027". */}
            <div className="relative rounded-lg border p-8" style={{ borderColor: "hsl(var(--eden-sage))" }}>
              <span className="absolute -top-3 left-6 rounded px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white" style={{ backgroundColor: "hsl(var(--eden-sage))" }}>
                Coming 2027
              </span>
              <GraduationCap className="mb-4 h-8 w-8" style={{ color: "hsl(var(--eden-sage))" }} />
              <h3 className="mb-1 font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>Tier 2 — Body Systems</h3>
              <p className="my-4 font-body text-sm leading-relaxed text-muted-foreground">14 modules through every major body system through a terrain-based, Biblical lens.</p>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />127 lessons across 14 modules</li>
                <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />Full clinical textbook included</li>
                <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />Herb-matching protocols</li>
                <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />Founding member coupon for waitlist</li>
              </ul>
              <p className="mb-1 text-center font-serif text-2xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>$1,497</p>
              <p className="mb-4 text-center font-body text-xs leading-snug" style={{ color: "hsl(var(--eden-bark) / 0.65)" }}>
                Public price — waitlist members get a founding coupon that drops it by $1,000.
              </p>
              {/* PR ι (iota): dual-CTA pair. Primary opens the
                  TierTwoWaitlistModal directly (1-click signup);
                  secondary "Learn More" routes to the full
                  /tier-2-waitlist info page for visitors who want to
                  read the timeline + founding-benefits copy first. */}
              <div className="flex flex-col gap-2 w-full">
                <Button
                  type="button"
                  variant="eden"
                  className="w-full whitespace-normal h-auto leading-snug py-2.5"
                  onClick={() => setTier2Modal(true)}
                  data-cta="tier-two-waitlist-courses"
                >
                  Join the Tier 2 Waitlist
                </Button>
                <Button
                  variant="eden-outline"
                  className="w-full whitespace-normal h-auto leading-snug py-2.5"
                  asChild
                >
                  <Link
                    to={ROUTES.TIER_TWO_WAITLIST}
                    data-cta="tier-two-waitlist-courses-learn-more"
                  >
                    Learn More
                  </Link>
                </Button>
              </div>

              {/* PR η fix #3: Tier 2 textbook "Coming 2028". */}
              <div className="mt-6 rounded-sm border p-6" style={{ backgroundColor: "hsl(var(--eden-parchment))", borderColor: "hsl(var(--eden-gold) / 0.3)" }}>
                <p className="font-accent text-xs tracking-widest uppercase mb-1" style={{ color: "hsl(var(--eden-gold))" }}>Companion Textbook · Tier 2 · Coming 2028</p>
                <h3 className="font-serif text-lg font-bold mb-2" style={{ color: "hsl(var(--eden-forest))" }}>Back to Eden: Body Systems &amp; Clinical Literacy</h3>
                <p className="font-body text-sm mb-4" style={{ color: "hsl(var(--eden-bark) / 0.75)" }}>A comprehensive 14-module clinical reference covering every major body system. Terrain-based, Scripture-anchored, practitioner-grade. Join the Tier 2 waitlist to be notified when both the course and textbook are available.</p>
                {/* PR ι (iota): companion-textbook waitlist CTA also
                    upgraded to dual-CTA pair. Same modal trigger as
                    the primary card above (single shared state). */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="eden"
                    size="sm"
                    onClick={() => setTier2Modal(true)}
                    data-cta="tier-two-waitlist-courses-textbook"
                  >
                    Join the Tier 2 Waitlist
                  </Button>
                  <Button
                    variant="eden-outline"
                    size="sm"
                    asChild
                  >
                    <Link
                      to={ROUTES.TIER_TWO_WAITLIST}
                      data-cta="tier-two-waitlist-courses-textbook-learn-more"
                    >
                      Learn More
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Tier 3 timing → TBD per Camila (was "Coming 2027"). Ship date is
                unknown; prefer vague over a date she might miss. */}
            <div className="relative rounded-lg border p-8 opacity-65" style={{ borderColor: "hsl(var(--border))" }}>
              <span className="absolute -top-3 left-6 rounded bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">TBD</span>
              <Users className="mb-4 h-8 w-8 text-muted-foreground" />
              <h3 className="mb-1 font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>Tier 3 — Clinical Practice</h3>
              <p className="my-4 font-body text-sm leading-relaxed text-muted-foreground">Advanced clinical application — tissue states, body pattern prescribing, and supervised practice.</p>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />Full clinical methodology</li>
                <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />Mentorship track</li>
                <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />Case study library</li>
                <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />Practitioner credential</li>
              </ul>
              <Button variant="eden-outline" className="w-full opacity-50" disabled>TBD</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 font-serif text-3xl font-bold text-white">This Is Not Wellness Culture. It's Restoration.</h2>
          <p className="mb-10 font-body text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
            Most courses teach you what a plant does. We teach you to read the person first —
            terrain, body pattern, tissue state — then match the plant.
          </p>
          <div className="grid gap-6 text-left md:grid-cols-3">
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="mb-3 font-serif text-lg font-semibold text-white">Biblically Grounded</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>Yahweh as ultimate healer. Every framework anchored in Scripture, free from Eastern religious concepts.</p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="mb-3 font-serif text-lg font-semibold text-white">Terrain-Based</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>We read the terrain, not the symptom. Body patterns, tissue states, and energetics are the tools.</p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="mb-3 font-serif text-lg font-semibold text-white">Clinically Rigorous</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>127 lessons, 14 body systems, clinical vocabulary, materia medica, and case frameworks built in.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PR η fix #6 (small): section-level pivot.
          2026-05-03 PR: same CTA-cluster restructure as hero — wrap each
          <a> in inline-flex w-full sm:w-auto, Button h-full, and add
          the Pattern-aware Amazon Kit CTA as a 3rd button so the
          revenue surface is present on the bottom of the page too. */}
      <section className="px-6 py-20" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 font-serif text-3xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
            {journeyCta.hasPattern ? "Continue Your Studies" : "Not Sure Where to Start?"}
          </h2>
          <p className="mb-8 font-body text-muted-foreground">
            {journeyCta.hasPattern
              ? "Your Pattern is already resolved. The next step is the Deep-Dive Guide for your terrain — ten matched herbs, nutrition, lifestyle, and Scripture, all aligned to your body pattern."
              : "Take the 2-minute Body Pattern Quiz. Discover your body pattern first."}
          </p>
          <div className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:flex-wrap">
            <JourneyAwareQuizCTA
              variant="eden"
              size="xl"
              noPatternLabel="Take the Free Quiz"
              className="w-full sm:w-auto h-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] py-3 px-6"
            />
            <a
              href={T1}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto"
            >
              <Button variant="eden-outline" size="xl" className="w-full h-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] py-3 px-6">
                Enroll in Tier 1 — $97
              </Button>
            </a>
            <a
              href={amazonKitUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              aria-label={amazonKitAriaLabel}
              data-cta="courses-bottom-amazon-kit"
              className="inline-flex w-full sm:w-auto"
            >
              <Button variant="eden-outline" size="xl" className="w-full h-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] py-3 px-6">
                {amazonKitLabel} →
              </Button>
            </a>
          </div>
          {/* FTC affiliate disclosure (mirrors hero cluster). */}
          <p className="mt-4 font-body text-[11px] italic text-muted-foreground">
            Amazon links are affiliate links — Eden Institute earns a small commission at no extra cost to you.
          </p>
        </div>
      </section>

      <Footer />

      {/* PR ι (iota): single TierTwoWaitlistModal mount serves both
          waitlist CTAs above (Tier 2 card + companion textbook). The
          surface tag distinguishes which CTA opened it for post-launch
          Leads Intelligence segmentation. */}
      <TierTwoWaitlistModal
        open={tier2Modal}
        onOpenChange={setTier2Modal}
        surface="courses_tier_two_card"
      />
    </div>
  );
};

export default Courses;
