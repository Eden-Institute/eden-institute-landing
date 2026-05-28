import { useState } from "react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import WaitlistModal from "@/components/landing/WaitlistModal";
import Navbar from "@/components/landing/Navbar";
import ProductShowcase from "@/components/landing/ProductShowcase";
import { BookOpen, Sprout, Users } from "lucide-react";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { supabase } from "@/integrations/supabase/client";
import { ROUTES } from "@/lib/routes";

const HS_AUD = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";

type WaitlistConfig = { title: string; subtitle?: string };

const Homeschool = () => {
  useDocumentMeta({
    title:
      "Eden's Table — K-12 Homeschool Herbalism Curriculum | The Eden Institute",
    description:
      "A K-12 Biblical herbalism curriculum for homeschool families. Open-and-go lesson plans, memory songs, kitchen labs, garden activities, and a recurring family story — rooted in Scripture and creation stewardship. Sprouts (K-2) Founders Edition ships August 1, 2026.",
    canonical: "https://edeninstitute.health/homeschool",
  });

  // ── Waitlist modal state (used by the hero's free-Weeks-1+2 lead-magnet CTA) ──
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistConfig, setWaitlistConfig] = useState<WaitlistConfig>({
    title: "",
  });
  const openWaitlist = (config: WaitlistConfig) => {
    setWaitlistConfig(config);
    setWaitlistOpen(true);
  };

  // ── Stripe checkout state (used by the pricing-section CTAs + showcase Reserve CTAs) ──
  const [checkoutLoadingKey, setCheckoutLoadingKey] = useState<string | null>(
    null,
  );
  const [checkoutError, setCheckoutError] = useState<string>("");

  const startCheckout = async (lookupKey: string) => {
    setCheckoutLoadingKey(lookupKey);
    setCheckoutError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-checkout",
        {
          body: {
            lookup_key: lookupKey,
            success_url: `https://edeninstitute.health/homeschool/welcome?session_id={CHECKOUT_SESSION_ID}&lookup_key=${lookupKey}`,
            cancel_url: "https://edeninstitute.health/homeschool#pricing",
          },
        },
      );
      if (fnError) throw fnError;
      if (data?.error) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Checkout failed",
        );
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      console.error("Checkout error:", err);
      setCheckoutError(message);
    } finally {
      setCheckoutLoadingKey(null);
    }
  };

  // ── Helpers for the showcase Reserve CTAs ──
  const reserveBundle = () => startCheckout("two_band_bundle");
  const reserveSprouts = () => startCheckout("sprouts_complete");
  const openLeadMagnet = () =>
    openWaitlist({
      title: "Get the first two weeks free",
      subtitle: "We'll send Weeks 1 and 2 of Sprouts to your inbox, free.",
    });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── §1 · Hero (cream, conversion pivot) ── */}
      <section
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-6"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Eden's Table
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Herbalism for the
            <br />
            <span className="italic">Whole Family Table.</span>
          </h1>
          <div
            className="w-16 h-px mx-auto my-8"
            style={{ backgroundColor: "hsl(var(--eden-gold))" }}
          />
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
            A K-12 Biblical herbalism curriculum for homeschool families.
            Open-and-go lesson plans, memory songs, kitchen labs, garden
            activities, and a recurring family story — rooted in Scripture and
            creation stewardship.
          </p>
          <p
            className="font-accent text-sm tracking-wider uppercase mb-8"
            style={{ color: "hsl(var(--eden-sage))" }}
          >
            Sprouts (K-2) + Seedlings (3-5) ship August 1, 2026 · Founders Edition open
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button variant="eden" size="xl" onClick={openLeadMagnet}>
              Get Sprouts Weeks 1 + 2 — Free
            </Button>
            <a
              href="#pricing"
              className="font-accent text-sm tracking-wider uppercase underline-offset-4 hover:underline"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Reserve Your Founders Edition Seat →
            </a>
          </div>
        </div>
      </section>

      {/* ── §2 · Four Grade Bands (band-range + badge corrections inline) ── */}
      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="font-serif text-3xl font-bold mb-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Four Grade Bands. One Family Vision.
            </h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">
              Eden's Table grows with your children — from wonder-filled kitchen
              labs to clinical reasoning in high school.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Sprouts — corrected K-2 + Aug 1 2026 badge */}
            <div
              className="rounded-lg p-6 border-2"
              style={{
                borderColor: "hsl(var(--eden-gold))",
                backgroundColor: "hsl(var(--eden-cream))",
              }}
            >
              <Sprout
                className="w-6 h-6 mb-3"
                style={{ color: "hsl(var(--eden-gold))" }}
              />
              <h3
                className="font-serif text-lg font-bold mb-1"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Sprouts
              </h3>
              <p
                className="font-accent text-xs tracking-widest uppercase mb-3"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Grades K-2
              </p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                Wonder, stories, and simple plant identification. Kitchen labs
                and memory songs.
              </p>
              <span
                className="text-xs font-body px-2 py-1 rounded"
                style={{
                  backgroundColor: "hsl(var(--eden-gold) / 0.15)",
                  color: "hsl(var(--eden-gold))",
                }}
              >
                Ships August 1, 2026
              </span>
            </div>

            {/* Seedlings — corrected 3-5 + Aug 1 2026 badge (now ships with Sprouts) */}
            <div
              className="rounded-lg p-6 border-2"
              style={{
                borderColor: "hsl(var(--eden-gold))",
                backgroundColor: "hsl(var(--eden-cream))",
              }}
            >
              <BookOpen
                className="w-6 h-6 mb-3"
                style={{ color: "hsl(var(--eden-gold))" }}
              />
              <h3
                className="font-serif text-lg font-bold mb-1"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Seedlings
              </h3>
              <p
                className="font-accent text-xs tracking-widest uppercase mb-3"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Grades 3-5
              </p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                Body systems basics, herb profiles, and family dinner
                discussions.
              </p>
              <span
                className="text-xs font-body px-2 py-1 rounded"
                style={{
                  backgroundColor: "hsl(var(--eden-gold) / 0.15)",
                  color: "hsl(var(--eden-gold))",
                }}
              >
                Ships August 1, 2026
              </span>
            </div>

            {/* Cultivators — corrected 6-8 */}
            <div
              className="rounded-lg p-6 border opacity-75"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <BookOpen className="w-6 h-6 mb-3 text-muted-foreground" />
              <h3
                className="font-serif text-lg font-bold mb-1"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Cultivators
              </h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3 text-muted-foreground">
                Grades 6-8
              </p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                Body pattern thinking, terrain basics, and garden-to-remedy
                workflows.
              </p>
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">
                Launches 2027
              </span>
            </div>

            {/* Practitioners — corrected 9-12 */}
            <div
              className="rounded-lg p-6 border opacity-75"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <Users className="w-6 h-6 mb-3 text-muted-foreground" />
              <h3
                className="font-serif text-lg font-bold mb-1"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Practitioners
              </h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3 text-muted-foreground">
                Grades 9-12
              </p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                Clinical literacy, materia medica, and real-world application.
              </p>
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">
                Launches 2028
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── §3 · Three Pillars (unchanged forest-green section) ── */}
      <section
        className="py-16 px-6"
        style={{ backgroundColor: "hsl(var(--eden-forest))" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-6 text-white">
            Open-and-Go. Family-Style. Faith-Rooted.
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-left mt-8">
            <div
              className="rounded-lg p-6"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">
                No Prep Required
              </h3>
              <p
                className="font-body text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                Every lesson includes a parent guide, student workbook, kitchen
                lab card, and garden activity card. Open and teach.
              </p>
            </div>
            <div
              className="rounded-lg p-6"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">
                Multi-Age by Design
              </h3>
              <p
                className="font-body text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                Lessons are written for the whole family to learn together.
                Older students go deeper; younger ones grow into it.
              </p>
            </div>
            <div
              className="rounded-lg p-6"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">
                Scripture Throughout
              </h3>
              <p
                className="font-body text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                Every unit anchored in Scripture. Herbalism presented as
                stewardship of Yahweh's creation, not alternative medicine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── §4 · Showcase 1 — Teacher Guide ── */}
      <ProductShowcase
        anchorId="showcase-tg"
        eyebrow="Showcase 1 · Teacher Guide"
        title="What every week looks like."
        subhead="Six pages per week. One herb. Five days. You open the binder Monday morning, teach it, close it. Every week follows the same rhythm — Scripture, Discovery, Kitchen Lab, History & Art, Garden & Review — so by Week 4 your child knows the shape of the week and the chant gets sung at breakfast. Below is Week 2 (chamomile) as an example."
        slides={[
          {
            src: "/showcases/hs-tg-01-wk-at-a-glance.png",
            alt: "Teacher Guide Week-at-a-Glance page — Sprouts Week 2 Chamomile",
            label: "Week-at-a-Glance",
            body: "The Sunday-night page. You open the binder after the children are in bed and see the whole week on one sheet: the herb of the week, the five-day arc, the chant, the question for the dinner table, the supplies in the corner. By Sunday at 9 p.m. you know what Monday morning will be. This is the page that makes the rest possible.",
          },
          {
            src: "/showcases/hs-tg-02-mon.png",
            alt: "Teacher Guide Monday Read-Aloud & Discussion page",
            label: "Monday — Read-Aloud & Discussion",
            body: "Every Monday is for Scripture. The page gives you the verse, three discussion questions, a Bear-the-puppy moment for the younger child still at the table, the week's chant, and teacher notes down the right margin. You read aloud. You don't improvise. Today's Word goes on the chalkboard. The week opens around the table, not at the desk.",
          },
          {
            src: "/showcases/hs-tg-03-tue.png",
            alt: "Teacher Guide Tuesday Discovery page",
            label: "Tuesday — Discovery",
            body: "Tuesday is sensory. The dried herb goes into your child's hand. She tells you what she sees, smells, notices. The page gives you a teaching progression — four numbered steps — and Today's Word that names a property of the plant (nervine, aromatic, demulcent, hardy). Teacher notes call Tuesday wonder day: stay curious with her. The page protects you from over-teaching.",
          },
          {
            src: "/showcases/hs-tg-04-wed.png",
            alt: "Teacher Guide Wednesday Kitchen Lab page",
            label: "Wednesday — Kitchen Lab",
            body: "Wednesday is the day she remembers a year from now. Numbered steps for a real preparation — band-appropriate (Sprouts: tea, infusion; Seedlings adds syrup, oxymel, decoction). The page splits roles: who measures, who pours boiling water, who covers, who strains. Today's Word names the preparation itself. The teaching note tells you which step the child does and which the adult does.",
          },
          {
            src: "/showcases/hs-tg-05-thu.png",
            alt: "Teacher Guide Thursday History & Art page",
            label: "Thursday — History & Art",
            body: "Thursday she steps into a 3,000-year ribbon. A historical figure who used this plant (Egyptians, Greeks, Romans, Hildegard, depending on the week). An entry to add to her Creation Care Timeline poster. An art activity with five numbered steps — observe, sketch, color. Today's Word names her vocation: HEALER, HERBALIST, BOTANIST. She joins the ribbon.",
          },
          {
            src: "/showcases/hs-tg-06-fri.png",
            alt: "Teacher Guide Friday Garden & Review page",
            label: "Friday — Garden & Review",
            body: "Friday is gathering. A garden activity for the week — plant the seeds, water the cuttings, harvest the leaves. Four review questions land what she learned. Bear moment. The chant gets sung one more time. Vovó closes the week with one line. Today's Word names something about the plant's life-cycle: HARDY, PERENNIAL, ANNUAL. The chair stays at the table.",
          },
        ]}
        pullQuote="You don't need to know herbalism to teach this. You open the page and the week unfolds."
        primaryCta={{
          label: "Get Sprouts Weeks 1 + 2 — Free",
          onClick: openLeadMagnet,
        }}
      />

      {/* ── §5 · Showcase 2 — Student Notebook ── */}
      <ProductShowcase
        anchorId="showcase-nb"
        eyebrow="Showcase 2 · Student Notebook"
        title="The page she'll show her grandfather."
        subhead="The student notebook is where the rigor shows. Five disciplines woven through five days, every week, for thirty-six weeks. The notebook your eight-year-old fills in is the same page you'd hand to a state homeschool reviewer. Below is one week of Seedlings — elderberry (Sambucus nigra) — as an example. Every week has this structure; the herb and the depth scale across the year."
        slides={[
          {
            src: "/showcases/hs-nb-01-mon.png",
            alt: "Student Notebook Monday — Scripture, Body, Discussion",
            label: "Monday — Scripture, Body, Discussion",
            body: 'Every Monday opens with a scripture that anchors the body theology of the week. Your child reads it, then names something her body does automatically — a sneeze, a scab, goosebumps — and writes WHY that\'s a clue God designed it. A "The Body Knows" panel says one true thing about the body\'s design. The body-system tag (Immune, Nervous, Digestive, Integumentary) places the week. Disciplines: Theology · ELA · Science · Health.',
          },
          {
            src: "/showcases/hs-nb-02-tue.png",
            alt: "Student Notebook Tuesday — Observation, Measurement, Energetics",
            label: "Tuesday — Observation, Measurement, Energetics",
            body: "Tuesday is the science page. She holds the herb, draws what she sees, measures it (millimeters, milligrams, count), and writes a hypothesis about plant chemistry — pigment, scent, structure. Today's Word is ENERGETICS — the warm/cool, dry/moist quality of the plant. The page does measurement, hypothesis, biological observation, and theology in one sitting. Disciplines: Science · Math · Theology · ELA.",
          },
          {
            src: "/showcases/hs-nb-03-wed.png",
            alt: "Student Notebook Wednesday — Kitchen Lab, Hypothesis, Safety",
            label: "Wednesday — Kitchen Lab, Hypothesis, Safety",
            body: "Wednesday is a real preparation she'll open weeks later. A ratio-based recipe (4:1 decoction, 1:1 honey, 1:3 oxymel) with blanks she fills in. A written hypothesis: predict color, smell, taste at opening. Safety in rust red — Seedlings handles cyanogenic glycosides, oxalates, dosing windows, species verification (Sambucus nigra, not racemosa). A garden activity ties the lab to the soil. Disciplines: Science · Math · Health · Latin nomenclature.",
          },
          {
            src: "/showcases/hs-nb-04-thu.png",
            alt: "Student Notebook Thursday — History, Botany, Math",
            label: "Thursday — History, Botany, Math",
            body: "Thursday she draws a botanical structure (compound umbel, raceme, panicle) and learns the family marker. She compares two historical figures who knew this plant — one Classical, one Christian or medieval — and writes WHY the same chemistry might be revealed to different people across centuries. Measurement math: leaf area, seed count, root length. Disciplines: History · Art · Theology · Math.",
          },
          {
            src: "/showcases/hs-nb-05-fri.png",
            alt: "Student Notebook Friday — Synthesis, Stewardship, Review",
            label: "Friday — Synthesis, Stewardship, Review",
            body: "Friday is synthesis. She names family-identification markers and explains how each would help her find a related plant in the wild. She writes three specific ways this herb helps her steward her body. She compares preparations and explains WHEN each is the right choice. Vovó closes with a Portuguese proverb. Disciplines: ELA · Science · Theology · Health.",
          },
        ]}
        pullQuote="This is what your child does at the kitchen table, that you can submit to the state."
        primaryCta={{
          label: checkoutLoadingKey === "two_band_bundle" ? "Loading…" : "Reserve Your Founders Edition Seat",
          onClick: reserveBundle,
        }}
      />

      {/* ── §6 · Showcase 3 — Herb Field Cards ── */}
      <ProductShowcase
        anchorId="showcase-fc"
        eyebrow="Showcase 3 · Herb Field Cards"
        title="What's on every card."
        subhead="Thirty-six cards per band — one for each week of the year. Same anatomy, different herb. The front is heritage botanical: the plant your child will learn to recognize in the wild. The back is working knowledge: properties, preparations, field marks, caution. Below is the Chamomile card as an example."
        slides={[
          {
            src: "/showcases/hs-fc-01-front.png",
            alt: "Herb Field Card front — Chamomile, Matricaria chamomilla",
            label: "Front",
            body: "Every front carries the same anatomy. Common name at the top. Latin binomial below it (Genus species) — what God named it in the language of science. Plant family. A Köhler-style botanical illustration — the same heritage plates physicians trained on for two hundred years. Eucalyptus framing. Torn-paper title label. A six-year-old can hold the card, walk into a garden, and start naming things.",
          },
          {
            src: "/showcases/hs-fc-02-back.png",
            alt: "Herb Field Card back — Properties, Preparation, Identify by, Caution",
            label: "Back",
            body: "Every back carries four working zones. PROPERTIES — three to five primary actions the herb is known for. PREPARATION — only the preparations a band-age child can handle (Sprouts: tea, infusion; Seedlings: decoction, oxymel, syrup; Cultivators: tincture, salve; Practitioners: clinical formulation). IDENTIFY BY — the field marks she uses to recognize the plant in the wild. CAUTION in rust red — where contraindications or family-allergy notes apply.",
          },
        ]}
        pullQuote="By the end of the year, your seven-year-old will know thirty-six plants by name, family, and use — more than most adults you know."
        primaryCta={{
          label: "Get Sprouts Weeks 1 + 2 — Free",
          onClick: openLeadMagnet,
        }}
        specs="36 cards per band · 4×6 portrait · 100lb cover with gloss laminate · double-sided · rigid storage box with weekly dividers."
      />

      {/* ── §7 · Showcase 4 — Recipe Cards ── */}
      <ProductShowcase
        anchorId="showcase-rc"
        eyebrow="Showcase 4 · Recipe Cards"
        title="The card that lives on your counter all year."
        subhead="Thirty-six recipe cards per band — one per week. Beautiful enough to display. Working enough to use. The front is the visual face for the counter. The back is the working face for the kitchen. Below is the Chamomile Tea card as an example."
        slides={[
          {
            src: "/showcases/hs-rc-01-front.png",
            alt: "Recipe Card front — Chamomile Tea display face",
            label: "Front",
            body: "Every front is a display face. The recipe title. A hero illustration of the prepared remedy — tea, syrup, oxymel, salve, depending on the week. Eucalyptus framing. The plant's Latin and family in small caps under the title. Visual restraint by design — the front is what you see when the card sits on the counter while she sets out the kettle. The working content lives on the back.",
          },
          {
            src: "/showcases/hs-rc-02-back.png",
            alt: "Recipe Card back — Ingredients, Method, Vovó says, Safety, Scripture",
            label: "Back",
            body: "Every back carries the same anatomy. INGREDIENTS — measurable, sourced, kid-doable. METHOD — five numbered steps maximum, parent-and-child achievable. VOVÓ SAYS — grandmother-wisdom in one line, the bridge of generational knowledge. SAFETY in rust red — where caution applies. SCRIPTURE — one anchoring verse in italic Caveat, with citation. A chant linkage back to the week the herb was taught.",
          },
        ]}
        pullQuote="By the end of the year, she has thirty-six preparations she can make from your kitchen."
        primaryCta={{
          label: checkoutLoadingKey === "two_band_bundle" ? "Loading…" : "Reserve Your Founders Edition Seat",
          onClick: reserveBundle,
        }}
        specs="36 cards per band · 4×6 landscape · 100lb cover with matte laminate · double-sided · rigid storage box with weekly dividers."
      />

      {/* ── §8 · Showcase 5 — Around the Table ── */}
      <ProductShowcase
        anchorId="showcase-att"
        eyebrow="Showcase 5 · Around the Table"
        title="Four kinds of conversation. Every week."
        subhead="Around the Table is a 144-card deck that lives at the dinner table, not the school desk. Four categories, 36 cards each — Body (green) asks what the body does and how God designed it; Faith (burgundy) opens a real theological question pulled from the week's herb; Family (gold) draws the grandmother across the table; Wonder (garden earth) sparks a curiosity question with no right answer. One card drawn at dinner. Read aloud. Everyone answers — child, parent, grandparent, guest. The example cards below are from Week 2 (chamomile) — Faith and Family — chosen to show the front-opens-it / back-lands-it pattern. Body and Wonder follow the same anatomy."
        slides={[
          {
            src: "/showcases/hs-att-01-faith-front.png",
            alt: "Around the Table Faith card front — theological question",
            label: "Faith FRONT",
            body: "Every Faith front opens a real theological question pulled from the week's herb. Not Sunday-school filler — the kind of question a six-year-old asks and a sixty-year-old is still asking. Burgundy header (Faith color in the four-category system). The week and herb attribution sit at the bottom. Faith conversations don't happen by accident at most tables. This deck creates them on a schedule.",
          },
          {
            src: "/showcases/hs-att-02-faith-back.png",
            alt: "Around the Table Faith card back — follow-up questions and scripture",
            label: "Faith BACK",
            body: "Every Faith back deepens the conversation. Two follow-up questions move the dinner from the opening question toward something specific. An anchoring scripture lands at the bottom in italic, with NASB citation. Then the attribution: which week's story this card belongs to, so the conversation links back to what your child learned at the desk. The front opens it. The back lands it.",
          },
          {
            src: "/showcases/hs-att-03-family-front.png",
            alt: "Around the Table Family card front — question that draws grandparents",
            label: "Family FRONT",
            body: "Every Family front opens a question that draws the grandparent across the table. Gold header (Family color). The questions are designed to surface family history, memory, and care — the example below asks who do you go to when you don't feel well? Your child asks. Your mother tells a story. The story becomes part of who your child is — built into the same week she learned what the plant does.",
          },
          {
            src: "/showcases/hs-att-04-family-back.png",
            alt: "Around the Table Family card back — follow-ups and Vovó says",
            label: "Family BACK",
            body: "Every Family back carries two follow-up questions and a Vovó-says closing line. Vovó is the Eden family grandmother — the deck lends her voice to the conversation, so a grandmother's wisdom is present even when your own grandmother isn't at the table that night. The week-and-herb attribution sits at the bottom. This is the back that turns a dinner into a memory.",
          },
        ]}
        pullQuote="This is the curriculum your husband notices — because it shows up at dinner."
        primaryCta={{
          label: checkoutLoadingKey === "two_band_bundle" ? "Loading…" : "Reserve Your Founders Edition Seat",
          onClick: reserveBundle,
        }}
        specs="144 cards per deck · 4 categories color-coded (Body Green / Faith Burgundy / Family Gold / Wonder Garden Earth) · 2.5×3.5 poker-size · 310gsm with linen finish · rigid box with 4 category dividers."
      />

      {/* ── §9 · Pricing — Founders Edition (Stripe checkout wired) ── */}
      <section
        id="pricing"
        className="py-20 md:py-24 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="font-accent text-sm tracking-[0.3em] uppercase mb-3"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Founders Edition — limited seats
            </p>
            <h2
              className="font-serif text-3xl md:text-4xl font-bold mb-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Reserve your seat at the table.
            </h2>
            <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto">
              Sprouts (K-2) ships August 1, 2026. Founding families get the
              first run of the full box at Founders pricing, with a voice in
              shaping Seedlings (3-5).
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Card 1 — Sprouts Complete */}
            <div
              className="rounded-lg p-8 border-2 bg-white flex flex-col"
              style={{ borderColor: "hsl(var(--eden-gold))" }}
            >
              <p
                className="font-accent text-xs tracking-widest uppercase mb-2"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Sprouts Complete · Founders
              </p>
              <h3
                className="font-serif text-2xl font-bold mb-4"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Ships August 1, 2026
              </h3>
              <p
                className="font-serif text-3xl font-bold mb-1"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                $249
              </p>
              <p className="font-body text-xs text-muted-foreground mb-6">
                One-time · Shipping calculated at checkout
              </p>
              <ul className="font-body text-sm text-muted-foreground space-y-2 mb-8 flex-1">
                <li>· 36 weekly lessons</li>
                <li>· Teacher Guide + Student Notebook</li>
                <li>· 36 Herb Field Cards</li>
                <li>· 36 Recipe Cards</li>
                <li>· Around the Table deck (144 cards)</li>
              </ul>
              <Button
                variant="eden"
                size="xl"
                className="w-full"
                disabled={checkoutLoadingKey === "sprouts_complete"}
                onClick={reserveSprouts}
              >
                {checkoutLoadingKey === "sprouts_complete"
                  ? "Loading…"
                  : "Reserve Your Seat"}
              </Button>
            </div>

            {/* Card 2 — Seedlings Complete (now ships with Sprouts Aug 1, 2026) */}
            <div
              className="rounded-lg p-8 border-2 bg-white flex flex-col"
              style={{ borderColor: "hsl(var(--eden-gold))" }}
            >
              <p
                className="font-accent text-xs tracking-widest uppercase mb-2"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Seedlings Complete · Founders
              </p>
              <h3
                className="font-serif text-2xl font-bold mb-4"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Ships August 1, 2026
              </h3>
              <p
                className="font-serif text-3xl font-bold mb-1"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                $249
              </p>
              <p className="font-body text-xs text-muted-foreground mb-6">
                One-time · Shipping calculated at checkout
              </p>
              <ul className="font-body text-sm text-muted-foreground space-y-2 mb-8 flex-1">
                <li>· 36 weekly lessons at Seedlings depth</li>
                <li>· Teacher Guide + Student Notebook</li>
                <li>· 36 Herb Field Cards</li>
                <li>· 36 Recipe Cards</li>
                <li>· Around the Table deck (144 cards)</li>
              </ul>
              <Button
                variant="eden"
                size="xl"
                className="w-full"
                disabled={checkoutLoadingKey === "seedlings_complete"}
                onClick={() => startCheckout("seedlings_complete")}
              >
                {checkoutLoadingKey === "seedlings_complete"
                  ? "Loading…"
                  : "Reserve Your Seat"}
              </Button>
            </div>

            {/* Card 3 — Two-Band Family Bundle (Best Value) */}
            <div
              className="rounded-lg p-8 border-2 bg-white relative flex flex-col"
              style={{ borderColor: "hsl(var(--eden-sage))" }}
            >
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 font-accent text-xs tracking-widest uppercase text-white px-3 py-1 rounded"
                style={{ backgroundColor: "hsl(var(--eden-sage))" }}
              >
                Best value
              </span>
              <p
                className="font-accent text-xs tracking-widest uppercase mb-2"
                style={{ color: "hsl(var(--eden-sage))" }}
              >
                Two-Band Family Bundle
              </p>
              <h3
                className="font-serif text-2xl font-bold mb-4"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Sprouts + Seedlings
              </h3>
              <p
                className="font-serif text-3xl font-bold mb-1"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                $449
              </p>
              <p className="font-body text-xs text-muted-foreground mb-6">
                Save $49 · Free shipping included
              </p>
              <ul className="font-body text-sm text-muted-foreground space-y-2 mb-8 flex-1">
                <li>· Both bands ship together August 1, 2026</li>
                <li>· All materials from both bands — TG, Notebooks, all cards, Around the Table</li>
                <li>· One purchase decision — no waiting for Seedlings</li>
                <li>· Add extra Student Notebooks for $39 each — for households with multiple children sharing the Teacher Guide, cards, and Around the Table deck</li>
              </ul>
              <Button
                variant="eden"
                size="xl"
                className="w-full"
                disabled={checkoutLoadingKey === "two_band_bundle"}
                onClick={reserveBundle}
              >
                {checkoutLoadingKey === "two_band_bundle"
                  ? "Loading…"
                  : "Reserve Your Seat"}
              </Button>
            </div>
          </div>

          {checkoutError && (
            <p className="text-center font-body text-sm text-destructive mb-4">
              {checkoutError}
            </p>
          )}

          <p className="font-body text-sm text-muted-foreground text-center max-w-2xl mx-auto">
            All Founders Edition seats include a voice in shaping Seedlings and
            first-look at Cultivators (2027) and Practitioners (2028).
          </p>
        </div>
      </section>

      <Footer />

      {/* WaitlistModal — used by the lead-magnet CTA (Get Sprouts Weeks 1+2 Free).
          Mounted at root, controlled by waitlistOpen state, dynamic title/subtitle
          set per CTA via openWaitlist(). Same audienceId (HS_AUD) for all uses. */}
      <WaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        audienceId={HS_AUD}
        title={waitlistConfig.title}
        subtitle={waitlistConfig.subtitle}
      />
    </div>
  );
};

export default Homeschool;
