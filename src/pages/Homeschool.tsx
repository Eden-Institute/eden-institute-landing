import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import WaitlistModal from "@/components/landing/WaitlistModal";
import Navbar from "@/components/landing/Navbar";
import { BookOpen, Sprout, Users } from "lucide-react";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

/**
 * Eden's Table waitlist audience (Resend).
 *
 * Phase 2 (this PR): Continues using the existing HS_AUD audience.
 * Phase 3 will migrate to a fresh `eden_table_waitlist` audience and segment
 * by the `source` intent tag (reserve / sprouts_magnet / seedlings_magnet).
 */
const HS_AUD = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";

/**
 * Three CTA intent tags, forwarded to the resend-waitlist EF as `source`.
 * All three add to the same Eden's Table waitlist audience; the tag enables
 * band-specific Day-7 nurture sends and monthly progress segmentation.
 */
type CTAIntent = "reserve" | "sprouts_magnet" | "seedlings_magnet";

type WaitlistConfig = {
  title: string;
  subtitle?: string;
  source: CTAIntent;
};

type ShowcaseSpec = {
  id: string;
  eyebrow: string;
  title: string;
  sproutsSrc: string;
  seedlingsSrc: string;
  sproutsAlt: string;
  seedlingsAlt: string;
  deepens: string;
  body: string;
  quote: string;
};

const SHOWCASES: ShowcaseSpec[] = [
  {
    id: "story",
    eyebrow: "Showcase 1 · Storybook",
    title: "The story that anchors the week.",
    sproutsSrc: "/showcases/STORY1Sprouts.png",
    seedlingsSrc: "/showcases/STORY7Seedlings.png",
    sproutsAlt: "Sprouts Storybook hero — Story 1 chapter cover",
    seedlingsAlt: "Seedlings Storybook hero — Story 7 chapter cover",
    deepens: "From a simple parable at K-2 to multi-character ethical arcs at 3-5.",
    body: "Every week opens with a story. At Sprouts, it's a single-character parable a six-year-old reads aloud. At Seedlings, the same family story grows into multi-character ethical arcs — characters face choices, scripture lands harder, the storybook becomes literature your child carries forward.",
    quote: "The story is what your child remembers. Everything else is built around it.",
  },
  {
    id: "tg",
    eyebrow: "Showcase 2 · Teacher Guide",
    title: "Open the page. Teach the week.",
    sproutsSrc: "/showcases/TGSprouts.png",
    seedlingsSrc: "/showcases/TGSeedlings.png",
    sproutsAlt: "Sprouts Teacher Guide open on cream linen",
    seedlingsAlt: "Seedlings Teacher Guide open on cream linen",
    deepens: "Open-and-teach at K-2 → six disciplines woven into one week at 3-5.",
    body: "You don't need to know herbalism to teach this. At Sprouts, each Monday's read-aloud is scripted; the kitchen lab is one preparation. At Seedlings, the same week weaves botany, chemistry, history, theology, and clinical safety — the page tells you exactly which day handles which discipline.",
    quote: "You open the binder. The week unfolds.",
  },
  {
    id: "nb",
    eyebrow: "Showcase 3 · Student Notebook",
    title: "The page your child shows her grandfather.",
    sproutsSrc: "/showcases/NBSprouts.png",
    seedlingsSrc: "/showcases/NBSeedlings.png",
    sproutsAlt: "Sprouts Student Notebook open — Tuesday Discovery and Wednesday Kitchen Lab",
    seedlingsAlt: "Seedlings Student Notebook open — measurement, hypothesis, safety panels",
    deepens: "Sensory observation at K-2 → measurement, hypothesis, and species verification at 3-5.",
    body: "At Sprouts, your child draws the herb, lists what she smells, writes a one-line response to scripture. At Seedlings, the same Wednesday measures the dried plant in millimeters, runs a 4:1 decoction ratio, writes a hypothesis to check eight weeks later, verifies species. Same rhythm. Real chemistry.",
    quote: "What your child fills in at the kitchen table — and what you submit to the state.",
  },
  {
    id: "fc",
    eyebrow: "Showcase 4 · Herb Field Cards",
    title: "What your child can identify in the wild.",
    sproutsSrc: "/showcases/FCSprouts.png",
    seedlingsSrc: "/showcases/FCSeedlings.png",
    sproutsAlt: "Sprouts Herb Field Cards with rigid storage box",
    seedlingsAlt: "Seedlings Herb Field Cards with rigid storage box",
    deepens: "36 Sprouts herbs + 36 Seedlings herbs = 72 unique plants in your child's library by 5th grade.",
    body: "Same heritage card format at both depths. Köhler-style botanical illustration on the front, four working zones on the back. Sprouts shows preparations a six-year-old can handle (tea, infusion). Seedlings shows preparations an eight-year-old can handle (decoction, oxymel, syrup). By the end of fifth grade, your child names and uses 72 plants — more than most adults you know.",
    quote: "Same heritage card. Deeper library.",
  },
  {
    id: "rc",
    eyebrow: "Showcase 5 · Recipe Cards",
    title: "What lives on your counter all year.",
    sproutsSrc: "/showcases/RCSprouts.png",
    seedlingsSrc: "/showcases/RCSeedlings.png",
    sproutsAlt: "Sprouts Recipe Cards with display box — Chamomile Tea card visible",
    seedlingsAlt: "Seedlings Recipe Cards with display box",
    deepens: "Tea + infusion at K-2 → decoction, oxymel, and slow medicines at 3-5.",
    body: "Same display-on-the-counter design at both depths. At Sprouts, the recipe is what a six-year-old can make with adult supervision — chamomile tea, honey water. At Seedlings, the child becomes a young apprentice — she measures, decoct, makes oxymels and elderberry syrup, all with safety call-outs in rust red.",
    quote: "By the end of the year, she has thirty-six preparations from your kitchen.",
  },
  {
    id: "att",
    eyebrow: "Showcase 6 · Around the Table",
    title: "The conversation that turns dinner into memory.",
    sproutsSrc: "/showcases/ATTSprouts.png",
    seedlingsSrc: "/showcases/ATTSeedlings.png",
    sproutsAlt: "Sprouts Around the Table Family deck with cards visible",
    seedlingsAlt: "Seedlings Around the Table Family deck with cards visible",
    deepens: "Same four categories. At 3-5, the questions add abstract reasoning and classical-tradition references.",
    body: "Body. Faith. Family. Wonder. Same four conversations at both depths, color-coded by category. At Sprouts the Faith card asks 'does God see us when we're hurting?' At Seedlings the same week asks 'what does it mean for your body to be a temple of the Holy Spirit?' Same chair. Older question. Vovó closes both.",
    quote: "The curriculum your husband notices — because it shows up at dinner.",
  },
];

const Homeschool = () => {
  useDocumentMeta({
    title: "Christian Homeschool Herbalism Curriculum (K-12) | Eden's Table",
    description: "A Christ-centered homeschool curriculum that teaches Biblical herbalism and the body God designed — open-and-go weekly lessons for K-2 and 3-5, rooted in Scripture and creation stewardship.",
    canonical: "https://edeninstitute.health/homeschool",
  });

  // Course structured data — rich-result eligibility for "Christian homeschool
  // curriculum" / "Biblical herbalism curriculum" searches. Injected on mount,
  // removed on unmount so it doesn't leak onto other routes.
  useEffect(() => {
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "homeschool-course-jsonld";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Eden's Table — Christian Homeschool Herbalism Curriculum",
      description:
        "A Christ-centered, Scripture-anchored K-12 homeschool curriculum teaching herbalism and the body God designed. Open-and-go weekly lessons for Sprouts (K-2) and Seedlings (3-5).",
      url: "https://edeninstitute.health/homeschool",
      inLanguage: "en",
      educationalLevel: "K-12",
      about: ["Christian homeschool curriculum", "Biblical herbalism", "Faith-based science", "creation stewardship"],
      provider: {
        "@type": "Organization",
        name: "The Eden Institute",
        url: "https://edeninstitute.health",
      },
      audience: {
        "@type": "EducationalAudience",
        educationalRole: "homeschooling family",
      },
    });
    document.head.appendChild(ld);
    return () => {
      document.getElementById("homeschool-course-jsonld")?.remove();
    };
  }, []);

  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistConfig, setWaitlistConfig] = useState<WaitlistConfig>({ title: "", source: "reserve" });
  const openWaitlist = (config: WaitlistConfig) => {
    setWaitlistConfig(config);
    setWaitlistOpen(true);
  };

  /**
   * Three CTA helpers. All three add to the same Eden's Table waitlist
   * audience, with distinct `source` tags for band-specific nurture routing.
   */
  const openReserveFounders = () => openWaitlist({
    title: "Reserve Founders Pricing",
    subtitle: "We'll email your Founders Code before launch — locks in $249 per band / $449 bundle before retail begins.",
    source: "reserve",
  });
  const openSproutsLeadMagnet = () => openWaitlist({
    title: "Get Sprouts Weeks 1 + 2 — Free",
    subtitle: "Your free preview of Sprouts Weeks 1 + 2 (Lavender + Chamomile) is on the way. We're finishing how we send these — you'll be among the first to receive when we open delivery.",
    source: "sprouts_magnet",
  });
  const openSeedlingsLeadMagnet = () => openWaitlist({
    title: "Get Seedlings Weeks 1 + 2 — Free",
    subtitle: "Your free preview of Seedlings Weeks 1 + 2 (Elderberry + Tulsi) is on the way. We're finishing how we send these — you'll be among the first to receive when we open delivery.",
    source: "seedlings_magnet",
  });

  /**
   * Reusable dual lead-magnet CTA pair (Sprouts + Seedlings, side-by-side).
   * Renders at the foot of each showcase and below the hero.
   */
  const DualLeadMagnetCTAs = ({ size = "lg" }: { size?: "lg" | "xl" }) => (
    <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch">
      <Button variant="eden-outline" size={size} onClick={openSproutsLeadMagnet}>
        Get Sprouts (K-2) Weeks 1 + 2 — Free
      </Button>
      <Button variant="eden-outline" size={size} onClick={openSeedlingsLeadMagnet}>
        Get Seedlings (3-5) Weeks 1 + 2 — Free
      </Button>
    </div>
  );

  const renderShowcase = (s: ShowcaseSpec, idx: number) => {
    const altBg = idx % 2 === 0;
    return (
      <section
        key={s.id}
        id={`showcase-${s.id}`}
        className="py-16 md:py-20 px-6"
        style={{ backgroundColor: altBg ? "hsl(var(--background))" : "hsl(var(--eden-cream) / 0.4)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-accent text-sm tracking-[0.3em] uppercase mb-3" style={{ color: "hsl(var(--eden-gold))" }}>{s.eyebrow}</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>{s.title}</h2>
          </div>
          {/* items-stretch + flex-1 wrappers equalize the two frames to the taller
              image's height; object-contain centers each photo without cropping or
              distortion. The cream mat matches the linen the mockups are shot on, so
              the letterbox on the shorter/narrower image reads as an intentional frame
              rather than empty space. Works for any pairing of portrait/landscape. */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-8 items-stretch">
            <div className="flex flex-col">
              <p className="font-accent text-xs tracking-[0.25em] uppercase mb-2 text-center" style={{ color: "hsl(var(--eden-gold))" }}>Sprouts · K-2</p>
              <div className="flex-1 flex items-center justify-center rounded-lg overflow-hidden shadow-sm" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
                <img src={s.sproutsSrc} alt={s.sproutsAlt} loading="lazy" className="max-w-full max-h-full w-auto h-auto object-contain" />
              </div>
            </div>
            <div className="flex flex-col">
              <p className="font-accent text-xs tracking-[0.25em] uppercase mb-2 text-center" style={{ color: "hsl(var(--eden-gold))" }}>Seedlings · 3-5</p>
              <div className="flex-1 flex items-center justify-center rounded-lg overflow-hidden shadow-sm" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
                <img src={s.seedlingsSrc} alt={s.seedlingsAlt} loading="lazy" className="max-w-full max-h-full w-auto h-auto object-contain" />
              </div>
            </div>
          </div>
          <div className="max-w-3xl mx-auto mb-8 text-center rounded-lg p-6" style={{ backgroundColor: "hsl(var(--eden-cream))", border: "1px solid hsl(var(--eden-gold) / 0.3)" }}>
            <p className="font-accent text-xs tracking-[0.25em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>What deepens at Seedlings</p>
            <p className="font-serif text-lg italic" style={{ color: "hsl(var(--eden-bark))" }}>{s.deepens}</p>
          </div>
          <p className="font-body text-base md:text-lg max-w-3xl mx-auto leading-relaxed text-foreground mb-8 text-center">{s.body}</p>
          <blockquote className="font-serif text-xl italic text-center mb-10 max-w-2xl mx-auto" style={{ color: "hsl(var(--eden-bark))" }}>“{s.quote}”</blockquote>
          <DualLeadMagnetCTAs />
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* §1 Hero */}
      <section className="py-20 md:py-28 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-accent text-sm tracking-[0.3em] uppercase mb-6" style={{ color: "hsl(var(--eden-gold))" }}>Eden's Table</p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6" style={{ color: "hsl(var(--eden-bark))" }}>
            Herbalism for the<br /><span className="italic">Whole Family Table.</span>
          </h1>
          <div className="w-16 h-px mx-auto my-8" style={{ backgroundColor: "hsl(var(--eden-gold))" }} />
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
            A K-12 Biblical herbalism curriculum for homeschool families. Open-and-go lesson plans, memory songs, kitchen labs, garden activities, and a recurring family story — rooted in Scripture and creation stewardship.
          </p>
          <p className="font-accent text-sm tracking-wider uppercase mb-8" style={{ color: "hsl(var(--eden-sage))" }}>
            Sprouts (K-2) + Seedlings (3-5) ship in 2027 · Founders pricing open now
          </p>
          <div className="flex flex-col items-center gap-5">
            <Button variant="eden" size="xl" onClick={openReserveFounders}>
              Reserve Founders Pricing →
            </Button>
            <p className="font-accent text-xs tracking-[0.25em] uppercase" style={{ color: "hsl(var(--eden-sage))" }}>
              or preview the curriculum free
            </p>
            <DualLeadMagnetCTAs />
          </div>
        </div>
      </section>

      {/* §2 Four Grade Bands */}
      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>Four Grade Bands. One Family Vision.</h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">Eden's Table grows with your children — from wonder-filled kitchen labs to clinical reasoning in high school.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="rounded-lg p-6 border-2" style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}>
              <Sprout className="w-6 h-6 mb-3" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Sprouts</h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3" style={{ color: "hsl(var(--eden-gold))" }}>Grades K-2</p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">Wonder, stories, and simple plant identification. Kitchen labs and memory songs.</p>
              <span className="text-xs font-body px-2 py-1 rounded" style={{ backgroundColor: "hsl(var(--eden-gold) / 0.15)", color: "hsl(var(--eden-gold))" }}>Ships 2027</span>
            </div>
            <div className="rounded-lg p-6 border-2" style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}>
              <BookOpen className="w-6 h-6 mb-3" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Seedlings</h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3" style={{ color: "hsl(var(--eden-gold))" }}>Grades 3-5</p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">Body systems basics, herb profiles, and family dinner discussions.</p>
              <span className="text-xs font-body px-2 py-1 rounded" style={{ backgroundColor: "hsl(var(--eden-gold) / 0.15)", color: "hsl(var(--eden-gold))" }}>Ships 2027</span>
            </div>
            <div className="rounded-lg p-6 border opacity-75" style={{ borderColor: "hsl(var(--border))" }}>
              <BookOpen className="w-6 h-6 mb-3 text-muted-foreground" />
              <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Cultivators</h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3 text-muted-foreground">Grades 6-8</p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">Body pattern thinking, terrain basics, and garden-to-remedy workflows.</p>
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">Launches after 2027</span>
            </div>
            <div className="rounded-lg p-6 border opacity-75" style={{ borderColor: "hsl(var(--border))" }}>
              <Users className="w-6 h-6 mb-3 text-muted-foreground" />
              <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Practitioners</h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3 text-muted-foreground">Grades 9-12</p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">Clinical literacy, materia medica, and real-world application.</p>
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">Launches after 2028</span>
            </div>
          </div>
        </div>
      </section>

      {/* §3 Three Pillars */}
      <section className="py-16 px-6" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-6 text-white">Open-and-Go. Family-Style. Faith-Rooted.</h2>
          <div className="grid md:grid-cols-3 gap-6 text-left mt-8">
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">No Prep Required</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>Every lesson includes a parent guide, student workbook, kitchen lab card, and garden activity card. Open and teach.</p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">Multi-Age by Design</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>Lessons are written for the whole family to learn together. Older students go deeper; younger ones grow into it.</p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">Scripture Throughout</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>Every unit anchored in Scripture. Herbalism presented as stewardship of Yahweh's creation, not alternative medicine.</p>
            </div>
          </div>
        </div>
      </section>

      {/* §4-§9 Showcases */}
      {SHOWCASES.map((s, idx) => renderShowcase(s, idx))}

      {/* §10 Pricing */}
      <section id="pricing" className="py-20 md:py-24 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <p className="font-accent text-sm tracking-[0.3em] uppercase mb-3" style={{ color: "hsl(var(--eden-gold))" }}>Founders Pricing — open until launch</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>Reserve your seat at the table.</h2>
          </div>

          <div className="max-w-3xl mx-auto mb-12 text-center rounded-lg p-5" style={{ backgroundColor: "hsl(var(--eden-bark))" }}>
            <p className="font-accent text-xs tracking-[0.25em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>How Founders pricing works</p>
            <p className="font-body text-sm text-white leading-relaxed">
              Join the waitlist and we'll email your Founders Code before launch. Use it at checkout to lock in Founders pricing. Retail begins at launch: <strong>$349 Sprouts · $349 Seedlings · $699 Bundle</strong>.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {/* Sprouts Complete */}
            <div className="rounded-lg overflow-hidden border-2 bg-white flex flex-col" style={{ borderColor: "hsl(var(--eden-gold))" }}>
              <div className="aspect-[4/3] overflow-hidden bg-white">
                <img src="/showcases/SproutsBundle.png" alt="Sprouts Complete bundle composition" loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <p className="font-accent text-xs tracking-widest uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>Sprouts Complete · Founders</p>
                <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>Ships 2027</h3>
                <div className="mb-4">
                  <p className="font-serif text-3xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                    $249 <span className="font-body text-base font-normal text-muted-foreground line-through ml-2">$349</span>
                  </p>
                  <p className="font-accent text-xs uppercase tracking-wider" style={{ color: "hsl(var(--eden-sage))" }}>Founders price · $100 below retail</p>
                </div>
                <ul className="font-body text-sm text-muted-foreground space-y-1.5 mb-6 flex-1">
                  <li>· 36 weekly lessons</li>
                  <li>· Teacher Guide + Student Notebook</li>
                  <li>· 36 Herb Field Cards</li>
                  <li>· 36 Recipe Cards</li>
                  <li>· Around the Table deck (144 cards)</li>
                </ul>
                <Button variant="eden" size="xl" className="w-full" onClick={openReserveFounders}>
                  Reserve Founders Pricing
                </Button>
              </div>
            </div>

            {/* Seedlings Complete */}
            <div className="rounded-lg overflow-hidden border-2 bg-white flex flex-col" style={{ borderColor: "hsl(var(--eden-gold))" }}>
              <div className="aspect-[4/3] overflow-hidden bg-white">
                <img src="/showcases/SeedlingsBundle.png" alt="Seedlings Complete bundle composition" loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <p className="font-accent text-xs tracking-widest uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>Seedlings Complete · Founders</p>
                <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>Ships 2027</h3>
                <div className="mb-4">
                  <p className="font-serif text-3xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                    $249 <span className="font-body text-base font-normal text-muted-foreground line-through ml-2">$349</span>
                  </p>
                  <p className="font-accent text-xs uppercase tracking-wider" style={{ color: "hsl(var(--eden-sage))" }}>Founders price · $100 below retail</p>
                </div>
                <ul className="font-body text-sm text-muted-foreground space-y-1.5 mb-6 flex-1">
                  <li>· 36 weekly lessons at Seedlings depth</li>
                  <li>· Teacher Guide + Student Notebook</li>
                  <li>· 36 Herb Field Cards</li>
                  <li>· 36 Recipe Cards</li>
                  <li>· Around the Table deck (144 cards)</li>
                </ul>
                <Button variant="eden" size="xl" className="w-full" onClick={openReserveFounders}>
                  Reserve Founders Pricing
                </Button>
              </div>
            </div>

            {/* Bundle */}
            <div className="rounded-lg overflow-hidden border-2 bg-white relative flex flex-col" style={{ borderColor: "hsl(var(--eden-sage))" }}>
              <span className="absolute top-3 right-3 z-10 font-accent text-xs tracking-widest uppercase text-white px-3 py-1 rounded" style={{ backgroundColor: "hsl(var(--eden-sage))" }}>Best value</span>
              <div className="grid grid-cols-2 aspect-[4/3] bg-white">
                <img src="/showcases/SproutsBundle.png" alt="Sprouts box" loading="lazy" className="w-full h-full object-cover border-r-2 border-white" />
                <img src="/showcases/SeedlingsBundle.png" alt="Seedlings box" loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <p className="font-accent text-xs tracking-widest uppercase mb-2" style={{ color: "hsl(var(--eden-sage))" }}>Two-Band Family Bundle</p>
                <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>Sprouts + Seedlings</h3>
                <div className="mb-4">
                  <p className="font-serif text-3xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                    $449 <span className="font-body text-base font-normal text-muted-foreground line-through ml-2">$699</span>
                  </p>
                  <p className="font-accent text-xs uppercase tracking-wider" style={{ color: "hsl(var(--eden-sage))" }}>Founders price · $250 below retail · Free shipping</p>
                </div>
                <ul className="font-body text-sm text-muted-foreground space-y-1.5 mb-6 flex-1">
                  <li>· Both bands ship together in 2027</li>
                  <li>· All materials from both bands</li>
                  <li>· Add extra Student Notebooks for $39 each</li>
                </ul>
                <Button variant="eden" size="xl" className="w-full" onClick={openReserveFounders}>
                  Reserve Founders Pricing
                </Button>
              </div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto text-center space-y-3">
            <p className="font-body text-sm text-muted-foreground leading-relaxed">All Founders Edition seats include a voice in shaping Seedlings and first-look at Cultivators and Practitioners as those bands roll out.</p>
            <p className="font-serif italic text-base" style={{ color: "hsl(var(--eden-bark))" }}>We're taking our time to choose the right print-on-demand partner. The waitlist is how you stay close to the work — and how you get Founders pricing when we open the store.</p>
          </div>
        </div>
      </section>

      <Footer />
      <WaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        audienceId={HS_AUD}
        title={waitlistConfig.title}
        subtitle={waitlistConfig.subtitle}
        source={waitlistConfig.source}
      />
    </div>
  );
};

export default Homeschool;
