import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AssessmentModal from "@/components/landing/AssessmentModal";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { GoldDivider } from "@/components/landing/BotanicalAccents";

const HERO_IMG = "https://images.unsplash.com/photo-1771128264855-1c032332cbc8?auto=format&fit=crop&w=1920&q=80";
const HERBS_IMG = "https://images.unsplash.com/photo-1580116270858-8a0d62b15426?auto=format&fit=crop&w=1200&q=80";
const BOTANICAL_IMG = "https://images.unsplash.com/photo-1492552085122-36706c238263?auto=format&fit=crop&w=1200&q=80";

const tissueStates = [
  { name: "Hot", desc: "You tend toward inflammation, redness, irritability, heartburn, and excess heat. Your skin flushes easily. You crave cold drinks. You run warm even when others are comfortable." },
  { name: "Cold", desc: "You tend toward sluggish digestion, pale skin, cold hands and feet, low energy, and slow metabolism. Your body feels like it's always trying to warm up." },
  { name: "Damp", desc: "You tend toward water retention, bloating, sinus congestion, heavy limbs, and mucus. Your body holds onto fluid and feels weighed down." },
  { name: "Dry", desc: "You tend toward dry skin, cracked lips, brittle nails, constipation, and dehydration at the cellular level. Your body struggles to retain moisture." },
  { name: "Tense", desc: "You tend toward muscle tightness, anxiety, spasms, cramping, and stress-driven symptoms. Your body holds everything too tightly." },
  { name: "Relaxed", desc: "You tend toward laxity, poor muscle tone, prolapse, varicose veins, and sluggish circulation. Your body doesn't hold structure well enough." },
];

const tenets = [
  { name: "Nutrition", desc: "Your body requires proper fuel. Not just calories, but living, mineral-rich, alkaline foods that nourish at the cellular level. When nutrition is deficient, no herb can compensate." },
  { name: "Elimination", desc: "Your body must be able to remove waste efficiently. The bowels, kidneys, lungs, skin, and lymphatic system all serve as channels of elimination. When these channels are congested, toxins accumulate and symptoms multiply." },
  { name: "Rest", desc: "Healing happens during rest. Deep, restorative sleep is not optional — it is essential to every repair process in the body. A body that cannot rest cannot heal." },
  { name: "Hydration", desc: "Water is the medium through which every cellular process occurs. Proper hydration means more than drinking water — it means the body's ability to absorb and utilize water at the tissue level." },
  { name: "Spiritual Alignment", desc: "Health is not merely physical. Scripture teaches that the body, mind, and spirit are interconnected. Anxiety, unforgiveness, bitterness, and spiritual disconnection manifest in the body just as surely as poor nutrition does. Healing begins when we align ourselves with the One who designed us." },
];

const biblicalDifferences = [
  "It acknowledges God as the designer of both the human body and the plants that serve it. Genesis 1:29 tells us that God gave humanity every seed-bearing plant. Ezekiel 47:12 describes trees whose leaves are \"for healing.\" Revelation 22:2 speaks of leaves \"for the healing of the nations.\" These aren't metaphors. They're descriptions of a created order that includes plant medicine by design.",
  "It rejects the reductionist \"take this for that\" model that dominates both conventional pharmacy and much of popular herbalism. Instead, it treats the whole person — body, mind, and spirit — within the context of their unique constitutional pattern.",
  "It prioritizes terrain over symptoms. The terrain is the internal environment of your body — your tissue states, your eliminative capacity, your constitutional tendencies. When the terrain is balanced, symptoms resolve on their own. When the terrain is ignored, symptoms return no matter how many herbs you take.",
  "It insists on clinical rigor. Biblical herbalism is not folk medicine or wellness trends. It requires understanding anatomy, physiology, tissue states, herbal actions, contraindications, and safety. It honors God's creation by studying it seriously.",
];

const tiers = [
  { tier: "Tier 1", title: "Biblical Framework and Foundations", desc: "Learn the theological and scientific basis for constitutional herbalism. Understand the six tissue states, the Five Tenets of Health, and how to begin reading your body's patterns. Enrollment opens June 2026." },
  { tier: "Tier 2", title: "Body Systems and Clinical Literacy", desc: "A comprehensive study of each body system through the lens of terrain-based assessment, herbal actions, materia medica, and clinical formulation." },
  { tier: "Tier 3", title: "Clinical Application and Mentorship", desc: "Advanced clinical training with real-world case studies, practitioner ethics, and mentored practice." },
];

const ConstitutionalHerbalism = () => {
  const [assessmentModal, setAssessmentModal] = useState(false);

  useEffect(() => {
    document.title = "What Is Constitutional Herbalism? | The Eden Institute";
    document.querySelector('meta[name="description"]')?.setAttribute("content", "Learn how constitutional herbalism matches herbs to your unique body pattern. Discover the six tissue states and the Biblical foundation for terrain-based plant medicine.");
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
            <Link to="/why-eden" className="font-body text-sm hover:opacity-80 transition-colors hidden sm:inline" style={{ color: "hsl(var(--eden-forest))" }}>
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

      {/* HERO */}
      <section className="relative min-h-[55vh] flex items-center overflow-hidden">
        <img src={HERO_IMG} alt="Rustic apothecary with dried herbs" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsla(40, 33%, 93%, 0.88) 0%, hsla(40, 33%, 93%, 0.82) 60%, hsla(40, 33%, 93%, 0.92) 100%)" }} />
        <div className="relative z-10 eden-container text-center max-w-4xl mx-auto px-6 pt-28 pb-20 md:pt-36 md:pb-24">
          <ScrollReveal>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6" style={{ color: "hsl(var(--eden-bark))" }}>
              What Is Constitutional Herbalism?
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p className="font-body text-xl md:text-2xl italic" style={{ color: "hsl(var(--eden-bark) / 0.7)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              A Biblical Framework for Matching Herbs to Your Body
            </p>
          </ScrollReveal>
          <div className="eden-divider" />
        </div>
      </section>

      <GoldDivider />

      {/* INTRO — Most people use herbs the wrong way */}
      <section className="section-padding-lg parchment-texture">
        <div className="eden-container max-w-3xl mx-auto px-6">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-8" style={{ color: "hsl(var(--eden-bark))" }}>
              Most people use herbs the wrong way.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="space-y-6 text-base md:text-lg leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.75)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              <p>They Google a symptom, buy whatever shows up first, take it for a week, feel nothing, and conclude that herbs don't work. But the herb was never the problem. The match was.</p>
              <p>Constitutional herbalism is the practice of matching herbs to the person — not the symptom. It's built on a simple but profound truth: God didn't design every body the same way. Your body has a pattern — a constitutional type — and when you understand that pattern, you stop guessing and start healing.</p>
              <p>This isn't new. It's one of the oldest frameworks in the history of medicine. And it's deeply consistent with what Scripture teaches about how God designed the human body.</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Botanical accent */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img src={BOTANICAL_IMG} alt="Herbs being prepared with mortar and pestle" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--eden-parchment)) 0%, transparent 30%, transparent 70%, #2C3E2D 100%)" }} />
      </div>

      {/* YOUR BODY HAS A PATTERN — Tissue States */}
      <section className="section-padding-lg relative overflow-hidden" style={{ backgroundColor: "#2C3E2D" }}>
        <img src={HERBS_IMG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-[0.07] mix-blend-luminosity" />
        <div className="eden-container max-w-5xl mx-auto relative z-10 px-6">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-6" style={{ color: "#F5F0E8" }}>
              Your Body Has a Pattern
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="max-w-3xl mx-auto mb-12 md:mb-16">
              <p className="text-base md:text-lg leading-relaxed text-center" style={{ color: "rgba(245, 240, 232, 0.8)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                Every person has a constitutional tendency — a baseline way their body operates. These tendencies aren't diseases. They're patterns. In clinical herbalism, we organize these patterns into six tissue states:
              </p>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tissueStates.map((ts, i) => (
              <ScrollReveal key={ts.name} delay={Math.min(i * 80, 400)}>
                <div className="rounded-lg p-6 h-full" style={{ backgroundColor: "rgba(245, 240, 232, 0.08)", border: "1px solid rgba(197, 164, 78, 0.25)" }}>
                  <h3 className="font-serif text-xl font-semibold mb-3" style={{ color: "#C5A44E" }}>{ts.name}</h3>
                  <p className="text-sm md:text-base leading-relaxed" style={{ color: "rgba(245, 240, 232, 0.75)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                    {ts.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={200}>
            <p className="text-base md:text-lg leading-relaxed text-center mt-10 max-w-3xl mx-auto" style={{ color: "rgba(245, 240, 232, 0.8)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              Most people are a combination of two or three patterns. Understanding your unique combination is the first step toward knowing which herbs, foods, and lifestyle practices will actually work for your body.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* WHY MATCHING MATTERS */}
      <section className="section-padding-lg parchment-texture">
        <div className="eden-container max-w-3xl mx-auto px-6">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-8" style={{ color: "hsl(var(--eden-bark))" }}>
              Why Matching Matters
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="space-y-6 text-base md:text-lg leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.75)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              <p>Here's where most herbal education fails: it teaches herbs by symptom rather than by person.</p>
              <div className="border-l-2 pl-6 my-8" style={{ borderColor: "#C5A44E" }}>
                <p className="italic" style={{ color: "hsl(var(--eden-bark) / 0.6)" }}>
                  "Take echinacea for a cold." "Take valerian for sleep." "Take turmeric for inflammation."
                </p>
              </div>
              <p>This is symptom-based herbalism — and it's the herbal equivalent of treating every patient the same regardless of who they are. It works sometimes, by accident, when the herb happens to match the person. But it fails far more often than it succeeds.</p>
              <p>Constitutional herbalism asks a different question. Instead of "what herb treats this symptom?" it asks: <em>"Why is THIS person experiencing this symptom, and what does THEIR body need to restore balance?"</em></p>
              <p>A person with a hot, tense constitution who can't sleep needs a very different herb than a person with a cold, relaxed constitution who can't sleep. Giving them both valerian isn't herbalism — it's guessing.</p>
              <p>When you match the herb to the constitution, the results aren't subtle. They're profound. Because you're not suppressing a symptom. You're restoring the terrain.</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Botanical accent */}
      <div className="relative h-48 md:h-56 overflow-hidden">
        <img src={BOTANICAL_IMG} alt="Botanical preparation" className="w-full h-full object-cover" style={{ objectPosition: "center 40%" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--eden-parchment)) 0%, transparent 30%, transparent 70%, #5C7A5C 100%)" }} />
      </div>

      {/* FIVE TENETS OF HEALTH */}
      <section className="section-padding-lg relative overflow-hidden" style={{ backgroundColor: "#5C7A5C" }}>
        <div className="eden-container max-w-5xl mx-auto relative z-10 px-6">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-4" style={{ color: "#F5F0E8" }}>
              The Five Tenets of Health
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={50}>
            <p className="text-base md:text-lg text-center max-w-3xl mx-auto mb-12" style={{ color: "rgba(245, 240, 232, 0.8)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              At The Eden Institute, constitutional herbalism sits within a larger framework. These five pillars represent the foundational conditions your body needs to heal itself — the way God designed it to:
            </p>
          </ScrollReveal>
          <div className="grid gap-6 md:gap-8">
            {tenets.map((t, i) => (
              <ScrollReveal key={t.name} delay={Math.min(i * 80, 300)}>
                <div className="border-l-2 pl-6 md:pl-8" style={{ borderColor: "#C5A44E" }}>
                  <h3 className="font-serif text-xl md:text-2xl font-semibold mb-2" style={{ color: "#C5A44E" }}>
                    {t.name}
                  </h3>
                  <p className="text-base md:text-lg leading-relaxed" style={{ color: "rgba(245, 240, 232, 0.8)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                    {t.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={200}>
            <p className="text-base md:text-lg leading-relaxed text-center mt-10 max-w-3xl mx-auto" style={{ color: "rgba(245, 240, 232, 0.8)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              When all five tenets are in balance, the body does what God designed it to do: heal itself. Herbs serve as allies in that process — not as replacements for it.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* WHAT MAKES BIBLICAL HERBALISM DIFFERENT */}
      <section className="section-padding-lg parchment-texture">
        <div className="eden-container max-w-4xl mx-auto px-6">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-6" style={{ color: "hsl(var(--eden-bark))" }}>
              What Makes Biblical Herbalism Different
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={50}>
            <p className="text-base md:text-lg leading-relaxed text-center max-w-3xl mx-auto mb-12" style={{ color: "hsl(var(--eden-bark) / 0.75)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              Biblical herbalism isn't simply herbalism practiced by Christians. It's a distinct framework that differs from both conventional medicine and mainstream herbal education in several important ways.
            </p>
          </ScrollReveal>
          <div className="grid gap-6 md:gap-8">
            {biblicalDifferences.map((diff, i) => (
              <ScrollReveal key={i} delay={Math.min(i * 80, 300)}>
                <div className="rounded-lg p-6 md:p-8 pl-8 md:pl-10 shadow-sm" style={{ backgroundColor: "hsl(var(--eden-cream))", borderLeft: "4px solid #C5A44E", border: "1px solid hsl(var(--eden-gold) / 0.2)", borderLeftWidth: "4px", borderLeftColor: "#C5A44E" }}>
                  <div className="flex items-start gap-4 md:gap-6">
                    <span className="font-serif text-3xl md:text-4xl font-bold leading-none shrink-0" style={{ color: "#C5A44E" }}>
                      {i + 1}
                    </span>
                    <p className="text-base md:text-lg leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.75)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                      {diff}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Botanical accent */}
      <div className="relative h-48 md:h-56 overflow-hidden">
        <img src={HERBS_IMG} alt="Apothecary shelf with botanical preparations" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--eden-parchment)) 0%, transparent 30%, transparent 70%, #2C3E2D 100%)" }} />
      </div>

      {/* DISCOVER YOUR TYPE + QUIZ CTA */}
      <section className="section-padding-lg relative overflow-hidden" style={{ backgroundColor: "#2C3E2D" }}>
        <div className="eden-container max-w-3xl mx-auto relative z-10 px-6 text-center">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-6" style={{ color: "#F5F0E8" }}>
              Discover Your Constitutional Type
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="space-y-6 text-base md:text-lg leading-relaxed mb-10" style={{ color: "rgba(245, 240, 232, 0.8)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              <p>Your body is already telling you what it needs. The question is whether you know how to listen.</p>
              <p>The Eden Institute offers a free Constitutional Type Quiz that assesses your unique pattern across the six tissue states. In just a few minutes, you'll discover whether you tend toward hot or cold, damp or dry, tense or relaxed — and you'll begin to understand why certain herbs have worked for you in the past while others haven't.</p>
              <p>This is the starting point. Once you know your constitution, everything changes — from the herbs you choose to the foods you eat to the way you approach your family's health.</p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <Button
              variant="eden-gold"
              size="xl"
              onClick={() => setAssessmentModal(true)}
              className="text-sm md:text-base"
            >
              Discover Your Constitutional Type — Take the Free Quiz
            </Button>
          </ScrollReveal>
        </div>
      </section>

      <GoldDivider />

      {/* LEARN THE FULL FRAMEWORK — Tiers */}
      <section className="section-padding-lg parchment-texture">
        <div className="eden-container max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-6" style={{ color: "hsl(var(--eden-bark))" }}>
              Learn the Full Framework
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={50}>
            <p className="text-base md:text-lg leading-relaxed text-center max-w-3xl mx-auto mb-12" style={{ color: "hsl(var(--eden-bark) / 0.75)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              The Eden Institute is a three-tier Biblical clinical herbalism education program designed to take you from foundational understanding to clinical competency:
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-12">
            {tiers.map((t, i) => (
              <ScrollReveal key={t.tier} delay={i * 100}>
                <div className="rounded-lg p-6 md:p-8 shadow-sm h-full" style={{ backgroundColor: "hsl(var(--eden-cream))", border: "1.5px solid hsl(var(--eden-gold) / 0.4)" }}>
                  <p className="font-accent text-xs tracking-[0.25em] uppercase mb-3 font-semibold" style={{ color: "#C5A44E" }}>
                    {t.tier}
                  </p>
                  <h3 className="font-serif text-lg md:text-xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>
                    {t.title}
                  </h3>
                  <p className="text-base leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.7)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
                    {t.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={200}>
            <p className="text-base md:text-lg leading-relaxed text-center max-w-3xl mx-auto" style={{ color: "hsl(var(--eden-bark) / 0.65)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              This isn't a weekend workshop. It's an institution built to train a generation of herbalists who take both Scripture and science seriously.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* SCRIPTURE CLOSING */}
      <section className="py-16 md:py-24 text-center" style={{ backgroundColor: "#2C3E2D" }}>
        <div className="eden-container max-w-3xl mx-auto px-6">
          <ScrollReveal>
            <blockquote className="font-serif text-lg sm:text-xl md:text-2xl italic leading-relaxed mb-4" style={{ color: "#C5A44E" }}>
              "I will give thanks to You, for I am fearfully and wonderfully made; wonderful are Your works, and my soul knows it very well."
            </blockquote>
            <cite className="text-sm" style={{ color: "rgba(245, 240, 232, 0.6)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              — Psalm 139:14 (NASB)
            </cite>
          </ScrollReveal>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section-padding parchment-texture text-center">
        <div className="eden-container max-w-2xl mx-auto px-6">
          <ScrollReveal>
            <Button
              variant="eden-gold"
              size="xl"
              onClick={() => setAssessmentModal(true)}
              className="text-sm md:text-base"
            >
              Discover Your Constitutional Type — Take the Free Quiz
            </Button>
          </ScrollReveal>
        </div>
      </section>

      <Footer />

      <AssessmentModal open={assessmentModal} onOpenChange={setAssessmentModal} />
    </main>
  );
};

export default ConstitutionalHerbalism;
