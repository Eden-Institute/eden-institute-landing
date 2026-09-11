import type { FullGuideContent } from "@/lib/guide-types";

/* Purchased Deep-Dive Guide, on-site rendering.
 *
 * Redesigned 2026-09-10 to match the emailed PDF (supabase/functions/constitution-pdf):
 * brand palette from the Brand Voice Guide SSOT, Cinzel eyebrows, Playfair titles,
 * EB Garamond body, a Köhler botanical plate of one of the pattern's own herbs on the
 * cover (public/guide-plates/<slug>.jpg), numbered herb cards, terracotta caution list.
 * Copy is the guide content verbatim; only em dashes are rendered as spaced en dashes
 * (Eden copy carries no em dashes). Type sizes are rem so the reader's text-size
 * setting (FontScaleProvider) still applies. */

const COLORS = {
  forest: "#2B3A1E",
  gold: "#C5A44E",
  softGold: "#E8D5A3",
  linen: "#F5EDD6",
  cream: "#FAF6EE",
  walnut: "#5C4A28",
  sage: "#8A9A5B",
  olive: "#6B7F3A",
  terracotta: "#B5643C",
  body: "#2E2A22",
  light: "#6F675A",
  white: "#FFFFFF",
};

const DISPLAY = "'Playfair Display', Georgia, serif";
const BODY = "'EB Garamond', 'Cormorant Garamond', Georgia, serif";
const EYEBROW = "Cinzel, 'Playfair Display', Georgia, serif";

const fix = (s: string) => String(s ?? "").replace(/\s*—\s*/g, " – ").replace(/…/g, "...");

const Eyebrow = ({ children, color = COLORS.sage, size = "0.75rem", className = "" }: { children: React.ReactNode; color?: string; size?: string; className?: string }) => (
  <p className={`uppercase ${className}`} style={{ fontFamily: EYEBROW, color, fontSize: size, letterSpacing: "0.22em", fontWeight: 700 }}>
    {children}
  </p>
);

const Diamond = ({ color = COLORS.gold, size = 6 }: { color?: string; size?: number }) => (
  <span aria-hidden className="inline-block rotate-45 shrink-0" style={{ width: size, height: size, backgroundColor: color }} />
);

const GoldDivider = () => (
  <div className="flex items-center justify-center my-12" aria-hidden>
    <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${COLORS.gold})` }} />
    <span className="mx-3 inline-block rotate-45" style={{ width: 7, height: 7, backgroundColor: COLORS.gold }} />
    <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${COLORS.gold}, transparent)` }} />
  </div>
);

const ScriptureBlock = ({ children }: { children: React.ReactNode }) => (
  <div className="my-10 py-8 px-8 md:px-12 text-center" style={{ backgroundColor: COLORS.linen, borderLeft: `3px solid ${COLORS.gold}`, borderRight: `3px solid ${COLORS.gold}` }}>
    <p className="italic leading-relaxed" style={{ fontFamily: DISPLAY, color: COLORS.forest, fontSize: "1.125rem" }}>
      {children}
    </p>
  </div>
);

const ChapterHeading = ({ number, title, subtitle }: { number: string; title: string; subtitle: string }) => (
  <div className="mb-8">
    <Eyebrow color={COLORS.gold} className="mb-3" size="0.8125rem">Chapter {number}</Eyebrow>
    <h2 className="font-bold leading-tight" style={{ fontFamily: DISPLAY, color: COLORS.forest, fontSize: "2rem" }}>
      {title}
    </h2>
    <p className="italic mt-2" style={{ color: COLORS.olive, fontSize: "1.0625rem" }}>{fix(subtitle)}</p>
    <div className="mt-4 h-px w-28" style={{ backgroundColor: COLORS.gold }} />
  </div>
);

const SectionLabel = ({ children, color = COLORS.sage }: { children: React.ReactNode; color?: string }) => (
  <Eyebrow color={color} className="mb-3">{children}</Eyebrow>
);

const Bullets = ({ items, color = COLORS.gold }: { items: string[]; color?: string }) => (
  <ul className="list-none space-y-2">
    {items.map((t, i) => (
      <li key={i} className="flex gap-3 items-baseline">
        <Diamond color={color} />
        <span>{fix(t)}</span>
      </li>
    ))}
  </ul>
);

interface Props {
  guide: FullGuideContent;
}

const GuideTemplate = ({ guide }: Props) => {
  const { chapterOne, chapterTwo, chapterThree, chapterFour, chapterFive, cautionHerbs, coachingCTA, courseCTA } = guide;
  const plateSrc = `/guide-plates/${guide.slug}.jpg`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.cream, fontFamily: BODY, fontSize: "1.0625rem", lineHeight: 1.7, color: COLORS.body }}>
      {/* === SAVE BAR === */}
      <header className="no-print sticky top-0 z-50 px-6 py-3 border-b" style={{ backgroundColor: COLORS.cream, borderColor: COLORS.softGold }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Eyebrow color={COLORS.forest} size="0.8125rem">The Eden Institute</Eyebrow>
          <button
            onClick={() => window.print()}
            className="w-auto px-5 py-2 rounded-sm uppercase font-bold transition-colors"
            style={{ backgroundColor: COLORS.forest, color: COLORS.cream, fontFamily: EYEBROW, fontSize: "0.75rem", letterSpacing: "0.16em" }}
          >
            Save as PDF
          </button>
        </div>
      </header>

      {/* === COVER === */}
      <div className="cover-section min-h-screen flex items-center justify-center p-6 md:p-10" style={{ backgroundColor: COLORS.cream }}>
        <div className="relative w-full max-w-2xl px-8 pt-14 pb-10 md:px-16 md:pt-16 text-center" style={{ border: `1.5px solid ${COLORS.gold}` }}>
          <div className="absolute inset-[6px] pointer-events-none" style={{ border: `0.5px solid ${COLORS.softGold}` }} />

          <Eyebrow color={COLORS.gold} size="0.9375rem" className="mb-1">The Eden Institute</Eyebrow>
          <p className="italic" style={{ color: COLORS.walnut, fontSize: "0.9375rem" }}>Back to Eden. Back to Truth.</p>

          <p className="italic mt-8" style={{ color: COLORS.olive, fontSize: "1.0625rem" }}>A Constitutional Deep-Dive Guide</p>
          <div className="flex items-center justify-center my-5" aria-hidden>
            <div className="h-px w-14" style={{ backgroundColor: COLORS.gold }} />
            <span className="mx-2 inline-block rotate-45" style={{ width: 6, height: 6, backgroundColor: COLORS.gold }} />
            <div className="h-px w-14" style={{ backgroundColor: COLORS.gold }} />
          </div>

          <h1 className="font-bold leading-tight mb-2" style={{ fontFamily: DISPLAY, color: COLORS.forest, fontSize: "2.5rem" }}>
            {guide.nickname}
          </h1>
          <Eyebrow color={COLORS.walnut} size="0.8125rem" className="mb-5">{guide.constitutionType}</Eyebrow>
          <p className="italic max-w-md mx-auto" style={{ color: COLORS.light, fontSize: "1rem" }}>
            {fix(guide.tagline)}
          </p>

          <img
            src={plateSrc}
            alt=""
            aria-hidden
            className="mx-auto mt-8 w-full max-w-xs"
            style={{ mixBlendMode: "multiply", opacity: 0.92 }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />

          <div className="mt-8 pt-5" style={{ borderTop: `1px solid ${COLORS.softGold}` }}>
            <Eyebrow color={COLORS.walnut} size="0.6875rem">edeninstitute.health</Eyebrow>
          </div>
        </div>
      </div>

      {/* === GUIDE BODY === */}
      <div className="guide-container max-w-3xl mx-auto px-6 md:px-10 py-16">

        {/* === CHAPTER ONE === */}
        <section className="mb-16">
          <ChapterHeading number="One" title="Your Pattern" subtitle={chapterOne.subtitle} />
          {chapterOne.paragraphs.map((p, i) => (
            <p key={i} className="mb-4">{fix(p)}</p>
          ))}
          <div className="mt-8 mb-6">
            <SectionLabel>Physical Tendencies</SectionLabel>
            <Bullets items={chapterOne.physicalTendencies} />
          </div>
          <div className="mb-6">
            <SectionLabel>Emotional &amp; Mental Tendencies</SectionLabel>
            <Bullets items={chapterOne.emotionalTendencies} />
          </div>
          <div className="mt-6">
            <SectionLabel>When Out of Balance</SectionLabel>
            <p>{fix(chapterOne.whenImbalanced)}</p>
          </div>
        </section>

        <GoldDivider />

        {/* === CHAPTER TWO === */}
        <section className="mb-16">
          <ChapterHeading number="Two" title="Historical Context" subtitle={chapterTwo.subtitle} />
          {chapterTwo.paragraphs.map((p, i) => (
            <p key={i} className="mb-4">{fix(p)}</p>
          ))}
        </section>

        <GoldDivider />

        {/* === CHAPTER THREE === */}
        <section className="mb-16">
          <ChapterHeading number="Three" title="Biblical Framework" subtitle={chapterThree.subtitle} />
          {chapterThree.paragraphs.map((p, i) => (
            <p key={i} className="mb-4">{fix(p)}</p>
          ))}
          <ScriptureBlock>{fix(chapterThree.scriptureVerse)}</ScriptureBlock>
          <p>{fix(chapterThree.closingParagraph)}</p>
        </section>

        <GoldDivider />

        {/* === CHAPTER FOUR === */}
        <section className="mb-16">
          <ChapterHeading number="Four" title="Your Herbal Allies" subtitle={chapterFour.subtitle} />
          <p className="mb-8">{fix(chapterFour.intro)}</p>

          <div className="space-y-6">
            {chapterFour.herbs.map((herb, i) => (
              <div
                key={i}
                className="herb-card overflow-hidden"
                style={{ borderLeft: `3px solid ${COLORS.sage}`, border: `1px solid ${COLORS.softGold}`, borderLeftWidth: 3, borderLeftColor: COLORS.sage, backgroundColor: COLORS.white }}
              >
                {/* Header */}
                <div className="px-5 py-3 flex flex-wrap items-baseline gap-x-3" style={{ backgroundColor: COLORS.linen }}>
                  <span className="font-bold" style={{ fontFamily: DISPLAY, color: COLORS.gold, fontSize: "1.25rem" }}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-bold" style={{ fontFamily: DISPLAY, color: COLORS.forest, fontSize: "1.125rem" }}>{herb.name}</span>
                  <span className="italic" style={{ color: COLORS.walnut, fontSize: "0.9375rem" }}>{herb.latin}</span>
                </div>
                {/* Body */}
                <div className="px-5 py-4 space-y-4" style={{ fontSize: "1rem" }}>
                  <div>
                    <SectionLabel>Actions</SectionLabel>
                    <p>
                      {herb.actions.map((a, ai) => (
                        <span key={ai}>
                          {ai > 0 && ", "}
                          <span className="clinical-term font-semibold" style={{ color: COLORS.forest }}>{a.term}</span>
                          {a.translation && (
                            <span className="clinical-translation italic" style={{ color: COLORS.olive }}> ({a.translation})</span>
                          )}
                        </span>
                      ))}
                    </p>
                  </div>
                  <div>
                    <SectionLabel>Why It Matches You</SectionLabel>
                    <p>{fix(herb.constitutionalMatch)}</p>
                  </div>
                  <div>
                    <SectionLabel>Preparation</SectionLabel>
                    <p>{fix(herb.preparation)}</p>
                  </div>
                  <div className="pt-3" style={{ borderTop: `1px solid ${COLORS.softGold}` }}>
                    <p className="italic" style={{ color: COLORS.light, fontSize: "0.9375rem" }}>
                      <span className="not-italic uppercase font-bold mr-2" style={{ fontFamily: EYEBROW, color: COLORS.terracotta, fontSize: "0.6875rem", letterSpacing: "0.18em" }}>Safety</span>
                      {fix(herb.safety)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <GoldDivider />

        {/* === HERBS TO USE WITH CAUTION === */}
        <section className="mb-16">
          <h2 className="font-bold mb-2" style={{ fontFamily: DISPLAY, color: COLORS.walnut, fontSize: "1.625rem" }}>
            Herbs and Foods to Use With Caution
          </h2>
          <p className="italic mb-6" style={{ color: COLORS.light, fontSize: "1rem" }}>The following may aggravate the {guide.nickname} pattern if used excessively.</p>
          <ul className="list-none space-y-3">
            {cautionHerbs.map((h, i) => (
              <li key={i} className="flex gap-3 items-baseline">
                <Diamond color={COLORS.terracotta} />
                <p>
                  <span className="font-semibold" style={{ color: COLORS.walnut }}>{h.name}</span>
                  {h.latin && <span className="italic" style={{ color: COLORS.light }}> ({h.latin})</span>}
                  <span> – {fix(h.reason)}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <GoldDivider />

        {/* === CHAPTER FIVE === */}
        <section className="mb-16">
          <ChapterHeading number="Five" title="Nutrition & Lifestyle" subtitle={chapterFive.subtitle} />
          <div className="space-y-8">
            <div>
              <SectionLabel>Dietary Guidance</SectionLabel>
              <p>{fix(chapterFive.dietary)}</p>
            </div>
            <div>
              <SectionLabel>Movement</SectionLabel>
              <p>{fix(chapterFive.movement)}</p>
            </div>
            <div>
              <SectionLabel>Rest &amp; Rhythm</SectionLabel>
              <p>{fix(chapterFive.restRhythm)}</p>
            </div>
            <div>
              <SectionLabel>Spiritual Practice</SectionLabel>
              <p>{fix(chapterFive.spiritualPractice)}</p>
            </div>
          </div>
        </section>

        <GoldDivider />

        {/* === COACHING CTA === */}
        <section className="mb-16">
          <Eyebrow color={COLORS.gold} className="mb-3" size="0.8125rem">Your Next Step</Eyebrow>
          <h2 className="font-bold mb-2" style={{ fontFamily: DISPLAY, color: COLORS.forest, fontSize: "1.75rem" }}>
            {coachingCTA.title}
          </h2>
          <p className="italic mb-4" style={{ color: COLORS.olive }}>{fix(coachingCTA.intro)}</p>
          <p className="mb-6">{fix(coachingCTA.body)}</p>
          <SectionLabel>In a 1:1 Constitutional Consultation, we will</SectionLabel>
          <div className="mb-8"><Bullets items={coachingCTA.bullets} /></div>
          <div className="p-6 text-center" style={{ backgroundColor: COLORS.linen, border: `1px solid ${COLORS.gold}` }}>
            <p className="font-bold mb-1" style={{ fontFamily: DISPLAY, color: COLORS.forest, fontSize: "1.25rem" }}>
              1:1 Constitutional Consultation
            </p>
            <p className="italic mb-4" style={{ color: COLORS.light, fontSize: "0.9375rem" }}>
              A personalized session to translate this guide into a protocol built for your body, your life, and your season.
            </p>
            <Eyebrow color={COLORS.walnut} size="0.6875rem">Coming Soon</Eyebrow>
          </div>
        </section>

        <GoldDivider />

        {/* === COURSE CTA === */}
        <section className="mb-16">
          <h2 className="font-bold mb-1" style={{ fontFamily: DISPLAY, color: COLORS.forest, fontSize: "1.75rem" }}>
            {courseCTA.title}
          </h2>
          <Eyebrow className="mb-6">{courseCTA.subtitle}</Eyebrow>
          <p className="mb-6">{fix(courseCTA.body)}</p>
          <SectionLabel>In the Foundations Course, you will discover</SectionLabel>
          <div className="mb-8"><Bullets items={courseCTA.bullets} /></div>
          <div className="p-6 md:p-8 text-center" style={{ backgroundColor: COLORS.forest }}>
            <p className="font-bold mb-1" style={{ fontFamily: DISPLAY, color: COLORS.cream, fontSize: "1.25rem" }}>
              The Foundations Course
            </p>
            <p className="italic mb-5" style={{ color: COLORS.softGold, fontSize: "0.9375rem" }}>
              Learn to read your body pattern, understand your body's language, and match it to God's provision in the plant world.
            </p>
            <a
              href="https://learn.edeninstitute.health/course/back-to-eden1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3 uppercase font-bold no-underline"
              style={{ backgroundColor: COLORS.gold, color: COLORS.forest, fontFamily: EYEBROW, fontSize: "0.75rem", letterSpacing: "0.16em" }}
            >
              Enroll Now – $197
            </a>
          </div>
        </section>

        <GoldDivider />

        {/* === CLOSING === */}
        <section className="text-center py-12">
          <Eyebrow color={COLORS.forest} size="0.9375rem" className="mb-2">The Eden Institute</Eyebrow>
          <p className="italic mb-6" style={{ color: COLORS.olive }}>Back to Eden. Back to Truth.</p>
          <p className="italic max-w-md mx-auto" style={{ color: COLORS.light, fontSize: "0.875rem" }}>
            This guide is educational only and does not constitute medical advice. For complex or serious health concerns, consult a qualified practitioner.
          </p>
        </section>
      </div>
    </div>
  );
};

export default GuideTemplate;
