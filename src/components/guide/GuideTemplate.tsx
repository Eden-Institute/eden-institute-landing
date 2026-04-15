import type { FullGuideContent } from "@/lib/guide-types";

const COLORS = {
  forest: "#2C3E2D",
  sage: "#5C7A5C",
  gold: "#C5A44E",
  cream: "#F5F0E8",
  warmWhite: "#FDFBF7",
  creamDark: "#EBE4D8",
  body: "#3D3832",
  light: "#6B6560",
  warmBrown: "#6B5344",
  goldPale: "#D4C088",
};

const GoldDivider = () => (
  <div className="flex items-center justify-center my-10">
    <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${COLORS.goldPale}, ${COLORS.gold}, ${COLORS.goldPale})` }} />
    <div className="mx-3 w-3 h-3 rotate-45 border" style={{ borderColor: COLORS.gold }} />
    <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${COLORS.goldPale}, ${COLORS.gold}, ${COLORS.goldPale})` }} />
  </div>
);

const ScriptureBlock = ({ children }: { children: React.ReactNode }) => (
  <div className="my-10 py-8 px-8 text-center" style={{
    backgroundColor: COLORS.warmWhite,
    borderLeft: `3px solid ${COLORS.gold}`,
    borderRight: `3px solid ${COLORS.gold}`,
  }}>
    <p className="italic text-lg leading-relaxed" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.sage }}>
      {children}
    </p>
  </div>
);

const ChapterHeading = ({ number, title }: { number: string; title: string }) => (
  <div className="mb-8">
    <p className="uppercase text-xs tracking-[0.3em] mb-2" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.sage }}>
      Chapter {number}
    </p>
    <h2 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.forest }}>
      {title}
    </h2>
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="uppercase text-[13px] tracking-[0.15em] mb-3 font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.sage }}>
    {children}
  </p>
);

interface Props {
  guide: FullGuideContent;
}

const GuideTemplate = ({ guide }: Props) => {
  const { chapterOne, chapterTwo, chapterThree, chapterFour, chapterFive, cautionHerbs, coachingCTA, courseCTA } = guide;

  return (
    <>
      <div className="min-h-screen" style={{ backgroundColor: COLORS.cream, fontFamily: "'EB Garamond', Georgia, serif", fontSize: "17px", lineHeight: 1.7, color: COLORS.body }}>
        {/* === SAVE BAR === */}
        <header className="no-print sticky top-0 z-50 px-6 py-3 border-b" style={{ backgroundColor: COLORS.cream, borderColor: COLORS.creamDark }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <span className="uppercase text-sm tracking-[0.2em] font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.forest }}>The Eden Institute</span>
            <button
              onClick={() => window.print()}
              className="px-5 py-2 rounded text-sm uppercase tracking-wider font-semibold transition-colors"
              style={{ backgroundColor: COLORS.forest, color: COLORS.cream, fontFamily: "'Playfair Display', serif" }}
            >
              Save as PDF
            </button>
          </div>
        </header>

        {/* === COVER SECTION === */}
        <div className="cover-section min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: COLORS.cream }}>
          <div className="relative w-full max-w-2xl p-12 md:p-16 text-center" style={{ border: `1.5px solid ${COLORS.gold}` }}>
            <div className="absolute inset-[6px]" style={{ border: `0.5px solid ${COLORS.goldPale}` }} />
            
            {/* Botanical SVG */}
            <div className="flex justify-center mb-8">
              <svg width="60" height="80" viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M30 75V20" stroke={COLORS.sage} strokeWidth="1.5" />
                <path d="M30 55C20 50 12 40 15 28" stroke={COLORS.sage} strokeWidth="1" fill="none" />
                <path d="M30 45C40 40 48 30 45 18" stroke={COLORS.sage} strokeWidth="1" fill="none" />
                <path d="M30 35C22 32 18 24 20 15" stroke={COLORS.sage} strokeWidth="1" fill="none" />
                <path d="M30 28C36 25 40 18 38 10" stroke={COLORS.sage} strokeWidth="1" fill="none" />
                <circle cx="15" cy="27" r="2.5" fill={COLORS.gold} opacity="0.7" />
                <circle cx="45" cy="17" r="2.5" fill={COLORS.gold} opacity="0.7" />
                <circle cx="20" cy="14" r="2" fill={COLORS.gold} opacity="0.5" />
                <circle cx="38" cy="9" r="2" fill={COLORS.gold} opacity="0.5" />
              </svg>
            </div>

            <p className="uppercase text-[24px] tracking-[0.2em] mb-2" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.forest, letterSpacing: "4px" }}>
              The Eden Institute
            </p>
            <p className="italic text-lg mb-10" style={{ color: COLORS.sage }}>
              Your Constitutional Deep-Dive Guide
            </p>

            <GoldDivider />

            <p className="uppercase text-[18px] tracking-[0.15em] mt-8 mb-3" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.forest, letterSpacing: "3px" }}>
              {guide.constitutionType}
            </p>
            <h1 className="text-[32px] md:text-[38px] font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.gold }}>
              {guide.nickname}
            </h1>
            <p className="italic text-base max-w-md mx-auto" style={{ color: COLORS.light }}>
              "{guide.tagline}"
            </p>

            <div className="mt-12 pt-6" style={{ borderTop: `1px solid ${COLORS.goldPale}` }}>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: COLORS.light }}>
                EdenInstitute.health
              </p>
            </div>
          </div>
        </div>

        {/* === GUIDE BODY === */}
        <div className="guide-container max-w-3xl mx-auto px-6 md:px-10 py-16">

          {/* === CHAPTER ONE === */}
          <section className="mb-16">
            <ChapterHeading number="One" title="Your Pattern" />
            <p className="italic text-base mb-6" style={{ color: COLORS.sage }}>{chapterOne.subtitle}</p>

            {chapterOne.paragraphs.map((p, i) => (
              <p key={i} className="mb-4">{p}</p>
            ))}

            <div className="mt-8 mb-6">
              <SectionLabel>Physical Tendencies</SectionLabel>
              <ul className="list-none space-y-2">
                {chapterOne.physicalTendencies.map((t, i) => (
                  <li key={i} className="flex gap-2"><span style={{ color: COLORS.gold }}>•</span><span>{t}</span></li>
                ))}
              </ul>
            </div>

            <div className="mb-6">
              <SectionLabel>Emotional & Mental Tendencies</SectionLabel>
              <ul className="list-none space-y-2">
                {chapterOne.emotionalTendencies.map((t, i) => (
                  <li key={i} className="flex gap-2"><span style={{ color: COLORS.gold }}>•</span><span>{t}</span></li>
                ))}
              </ul>
            </div>

            <div className="mt-6">
              <SectionLabel>When Imbalanced</SectionLabel>
              <p>{chapterOne.whenImbalanced}</p>
            </div>
          </section>

          <GoldDivider />

          {/* === CHAPTER TWO === */}
          <section className="mb-16">
            <ChapterHeading number="Two" title="Historical Context" />
            <p className="italic text-base mb-6" style={{ color: COLORS.sage }}>{chapterTwo.subtitle}</p>
            {chapterTwo.paragraphs.map((p, i) => (
              <p key={i} className="mb-4">{p}</p>
            ))}
          </section>

          <GoldDivider />

          {/* === CHAPTER THREE === */}
          <section className="mb-16">
            <ChapterHeading number="Three" title="Biblical Framework" />
            <p className="italic text-base mb-6" style={{ color: COLORS.sage }}>{chapterThree.subtitle}</p>
            {chapterThree.paragraphs.map((p, i) => (
              <p key={i} className="mb-4">{p}</p>
            ))}
            <ScriptureBlock>{chapterThree.scriptureVerse}</ScriptureBlock>
            <p>{chapterThree.closingParagraph}</p>
          </section>

          <GoldDivider />

          {/* === CHAPTER FOUR === */}
          <section className="mb-16">
            <ChapterHeading number="Four" title="Your Herbal Allies" />
            <p className="italic text-base mb-4" style={{ color: COLORS.sage }}>{chapterFour.subtitle}</p>
            <p className="mb-8">{chapterFour.intro}</p>

            <div className="space-y-6">
              {chapterFour.herbs.map((herb, i) => (
                <div
                  key={i}
                  className="herb-card rounded overflow-hidden transition-colors"
                  style={{ borderLeft: `3px solid ${COLORS.sage}`, backgroundColor: COLORS.warmWhite }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderLeftColor = COLORS.gold)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderLeftColor = COLORS.sage)}
                >
                  {/* Header */}
                  <div className="px-5 py-3 flex flex-wrap items-baseline gap-x-3" style={{ backgroundColor: COLORS.creamDark }}>
                    <span className="text-[22px] font-bold" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.gold }}>{i + 1}.</span>
                    <span className="text-[17px] font-bold" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.forest }}>{herb.name}</span>
                    <span className="italic text-[15px]" style={{ color: COLORS.light }}>{herb.latin}</span>
                  </div>
                  {/* Body */}
                  <div className="px-5 py-4 space-y-3" style={{ fontSize: "16px" }}>
                    <div>
                      <SectionLabel>Actions</SectionLabel>
                      <p>
                        {herb.actions.map((a, ai) => (
                          <span key={ai}>
                            {ai > 0 && ", "}
                            <span className="clinical-term font-medium" style={{ color: COLORS.forest }}>{a.term}</span>
                            {a.translation && (
                              <span className="clinical-translation italic" style={{ color: COLORS.sage, fontSize: "0.92em" }}> ({a.translation})</span>
                            )}
                          </span>
                        ))}
                      </p>
                    </div>
                    <div>
                      <SectionLabel>Constitutional Match</SectionLabel>
                      <p>{herb.constitutionalMatch}</p>
                    </div>
                    <div>
                      <SectionLabel>Preparation</SectionLabel>
                      <p>{herb.preparation}</p>
                    </div>
                    <div className="pt-3" style={{ borderTop: `1px solid ${COLORS.creamDark}` }}>
                      <p className="italic text-[15px]" style={{ color: COLORS.light }}>
                        <span className="font-semibold not-italic" style={{ color: COLORS.sage }}>Safety: </span>
                        {herb.safety}
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
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.warmBrown }}>
              Herbs to Use with Caution
            </h2>
            <p className="italic text-sm mb-6" style={{ color: COLORS.light }}>The following may aggravate the {guide.nickname} pattern if used excessively:</p>
            <div className="p-6 rounded space-y-4" style={{ backgroundColor: COLORS.warmWhite, border: `1px solid ${COLORS.creamDark}` }}>
              {cautionHerbs.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <span style={{ color: COLORS.warmBrown }}>•</span>
                  <p>
                    <span className="font-semibold" style={{ color: COLORS.warmBrown }}>{h.name}</span>
                    {h.latin && <span className="italic" style={{ color: COLORS.light }}> ({h.latin})</span>}
                    : {h.reason}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <GoldDivider />

          {/* === CHAPTER FIVE === */}
          <section className="mb-16">
            <ChapterHeading number="Five" title="Nutrition & Lifestyle" />
            <p className="italic text-base mb-8" style={{ color: COLORS.sage }}>{chapterFive.subtitle}</p>

            <div className="space-y-8">
              <div>
                <SectionLabel>Dietary Guidance</SectionLabel>
                <p>{chapterFive.dietary}</p>
              </div>
              <div>
                <SectionLabel>Movement</SectionLabel>
                <p>{chapterFive.movement}</p>
              </div>
              <div>
                <SectionLabel>Rest & Rhythm</SectionLabel>
                <p>{chapterFive.restRhythm}</p>
              </div>
              <div>
                <SectionLabel>Spiritual Practice</SectionLabel>
                <p>{chapterFive.spiritualPractice}</p>
              </div>
            </div>
          </section>

          <GoldDivider />

          {/* === COACHING CTA === */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.forest }}>
              {coachingCTA.title}
            </h2>
            <p className="italic mb-4" style={{ color: COLORS.sage }}>{coachingCTA.intro}</p>
            <p className="mb-6">{coachingCTA.body}</p>
            <p className="mb-4 font-semibold" style={{ color: COLORS.forest }}>In a 1:1 Constitutional Consultation, we will:</p>
            <ul className="list-none space-y-2 mb-8">
              {coachingCTA.bullets.map((b, i) => (
                <li key={i} className="flex gap-2"><span style={{ color: COLORS.gold }}>•</span><span>{b}</span></li>
              ))}
            </ul>
            <div className="p-6 rounded text-center" style={{ backgroundColor: COLORS.warmWhite, border: `2px solid ${COLORS.gold}` }}>
              <p className="text-xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.forest }}>
                1:1 Constitutional Consultation
              </p>
              <p className="italic text-sm mb-4" style={{ color: COLORS.light }}>
                A personalized session to translate this guide into a protocol built for your body, your life, and your season.
              </p>
              <span className="inline-block px-6 py-3 rounded text-sm uppercase tracking-wider font-semibold" style={{ backgroundColor: COLORS.creamDark, color: COLORS.sage, fontFamily: "'Playfair Display', serif" }}>
                Coming Soon
              </span>
            </div>
          </section>

          <GoldDivider />

          {/* === COURSE CTA === */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.forest }}>
              {courseCTA.title}
            </h2>
            <p className="uppercase text-xs tracking-[0.2em] mb-6" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.sage }}>
              {courseCTA.subtitle}
            </p>
            <p className="mb-6">{courseCTA.body}</p>
            <p className="mb-4 font-semibold" style={{ color: COLORS.forest }}>In the Foundations Course, you will discover:</p>
            <ul className="list-none space-y-2 mb-8">
              {courseCTA.bullets.map((b, i) => (
                <li key={i} className="flex gap-2"><span style={{ color: COLORS.gold }}>•</span><span>{b}</span></li>
              ))}
            </ul>
            <div className="p-6 rounded text-center" style={{ backgroundColor: COLORS.forest }}>
              <p className="text-xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.cream }}>
                The Foundations Course
              </p>
              <p className="italic text-sm mb-4" style={{ color: COLORS.goldPale }}>
                Learn to read your constitution, understand your body's language, and match it to God's provision in the plant world.
              </p>
              <a href="https://learn.edeninstitute.health/course/back-to-eden1" target="_blank" rel="noopener noreferrer" className="inline-block px-8 py-3 rounded text-sm uppercase tracking-wider font-bold no-underline" style={{ backgroundColor: COLORS.gold, color: COLORS.forest, fontFamily: "'Playfair Display', serif" }}> target="_blank" rel="noopener noreferrer" className="inline-block px-8 py-3 rounded text-sm uppercase tracking-wider font-bold no-underline" style={{ backgroundColor: COLORS.gold, color: COLORS.forest, fontFamily: "'Playfair Display', serif" }}> target="_blank" rel="noopener noreferrer" className="inline-block px-8 py-3 rounded text-sm uppercase tracking-wider font-bold no-underline" style={{ backgroundColor: COLORS.gold, color: COLORS.forest, fontFamily: "'Playfair Display', serif" }}>
                Enroll Now — $197
              </a>
            </div>
          </section>

          <GoldDivider />

          {/* === CLOSING === */}
          <section className="text-center py-12">
            <p className="uppercase text-xl tracking-[0.2em] font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: COLORS.forest }}>
              The Eden Institute
            </p>
            <p className="italic mb-6" style={{ color: COLORS.sage }}>Back to Eden. Back to Truth.</p>
            <p className="text-sm italic" style={{ color: COLORS.light }}>
              This guide is educational only and does not constitute medical advice. For complex or serious health concerns, consult a qualified practitioner.
            </p>
          </section>
        </div>
      </div>
    </>
  );
};

export default GuideTemplate;
