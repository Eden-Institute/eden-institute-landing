import { useEffect, useState } from "react";
import Navbar from "@/components/landing/Navbar";
import GetInvolvedSection from "@/components/landing/GetInvolvedSection";
import { getAmazonKitUrl } from "@/lib/amazonKitUrls";
import { supabase } from "@/integrations/supabase/client";
import heroBotanical from "@/assets/hero-botanical.jpg";

function Arrow() {
  return (
    <div
      className="three-steps-arrow hidden items-center justify-center"
      aria-hidden="true"
      style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: "32px",
        color: "hsl(var(--honey))",
        lineHeight: 1,
      }}
    >
      →
    </div>
  );
}

interface StepCardProps {
  num: string;
  title: string;
  price: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  ctaVariant: "honey" | "outline";
  ctaExternal?: boolean;
}

function StepCard({
  num,
  title,
  price,
  body,
  ctaLabel,
  ctaHref,
  ctaVariant,
  ctaExternal,
}: StepCardProps) {
  const isHoney = ctaVariant === "honey";
  return (
    <article
      className="flex flex-col bg-white"
      style={{
        borderRadius: "4px",
        border: "0.5px solid hsl(var(--sage-border) / 0.6)",
        borderTop: "3px solid hsl(var(--green-deep))",
        padding: "32px",
      }}
    >
      <div
        className="italic mb-3"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 300,
          fontSize: "48px",
          lineHeight: 1,
          color: "hsl(var(--honey))",
        }}
      >
        {num}
      </div>
      <h3
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 500,
          fontSize: "26px",
          lineHeight: 1.2,
          color: "hsl(var(--green-deep))",
          marginBottom: "6px",
        }}
      >
        {title}
      </h3>
      <p
        className="italic mb-4"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: "16px",
          color: "hsl(var(--green-mid))",
        }}
      >
        {price}
      </p>
      <p
        className="flex-1"
        style={{
          fontFamily: "'EB Garamond', Georgia, serif",
          fontSize: "16px",
          lineHeight: 1.65,
          color: "hsl(var(--ink-soft))",
          marginBottom: "24px",
        }}
      >
        {body}
      </p>
      <a
        href={ctaHref}
        {...(ctaExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="self-start inline-flex items-center justify-center transition-colors duration-200 min-h-[44px]"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 600,
          fontSize: "14px",
          letterSpacing: "0.06em",
          padding: "10px 20px",
          borderRadius: "2px",
          backgroundColor: isHoney ? "hsl(var(--honey))" : "transparent",
          color: isHoney ? "hsl(var(--green-deep))" : "hsl(var(--green-deep))",
          border: isHoney
            ? "1px solid hsl(var(--honey))"
            : "1px solid hsl(var(--green-deep))",
        }}
      >
        {ctaLabel}
      </a>
    </article>
  );
}

const Index = () => {
  const [patternSlug, setPatternSlug] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("current_user_tier" as never).then(
      () => {},
      () => {}
    );
    try {
      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem("edenConstitutionSlug")
          : null;
      if (stored) setPatternSlug(stored);
    } catch {
      // localStorage unavailable (e.g. private mode) — non-fatal
    }
  }, []);

  const hasPattern = Boolean(patternSlug);
  const bundleUrl = getAmazonKitUrl(patternSlug);
  const guideUrl = patternSlug ? `/guide/${patternSlug}` : "/assessment";

  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />

      <section
        id="hero"
        aria-label="Hero"
        className="relative flex items-center justify-center px-8 overflow-hidden"
        style={{
          backgroundColor: "hsl(var(--cream))",
          backgroundImage: `
            radial-gradient(circle at 100% 0%, hsl(var(--green-mid) / 0.08), transparent 50%),
            radial-gradient(circle at 0% 100%, hsl(var(--honey) / 0.08), transparent 50%)
          `,
          paddingTop: "clamp(60px, 8vw, 120px)",
          paddingBottom: "clamp(60px, 8vw, 120px)",
        }}
      >
        {/* Vintage botanical overlay — chamomile, lavender, echinacea engravings */}
        <img
          src={heroBotanical}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          style={{
            opacity: 0.32,
            mixBlendMode: "multiply",
          }}
        />
        <div className="relative z-10 max-w-[960px] w-full mx-auto text-center">
          <p
            className="uppercase tracking-[0.18em] mb-6"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 600,
              fontSize: "11px",
              color: "hsl(var(--green-mid))",
            }}
          >
            THE EDEN INSTITUTE
          </p>

          <h1
            className="mb-0"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(38px, 5vw, 64px)",
              lineHeight: 1.1,
              color: "hsl(var(--green-deep))",
            }}
          >
            <span className="block">A framework our culture forgot.</span>
            <span
              className="block italic"
              style={{ color: "hsl(var(--rust))" }}
            >
              We are teaching it back.
            </span>
          </h1>

          <div
            className="mx-auto"
            style={{
              width: "80px",
              height: "2px",
              backgroundColor: "hsl(var(--honey))",
              marginTop: "28px",
              marginBottom: "28px",
            }}
          />

          <p
            className="mx-auto"
            style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontSize: "19px",
              color: "hsl(var(--ink))",
              maxWidth: "680px",
              lineHeight: 1.7,
            }}
          >
            Our bodies were designed to signal. To repair. To steward themselves
            with help from the plants God gave for food and healing.{" "}
            <span
              className="italic"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                color: "hsl(var(--green-dark))",
              }}
            >
              Somewhere along the way, we stopped listening.
            </span>
          </p>
        </div>
      </section>

      <section id="four-doors" aria-label="Four doors"></section>

      <section
        id="framework"
        aria-label="Framework"
        className="px-8"
        style={{
          backgroundColor: "hsl(var(--cream-light))",
          paddingTop: "clamp(60px, 8vw, 120px)",
          paddingBottom: "clamp(60px, 8vw, 120px)",
        }}
      >
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-16">
            <p
              className="uppercase tracking-[0.18em] mb-6"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 600,
                fontSize: "11px",
                color: "hsl(var(--green-mid))",
              }}
            >
              THE FRAMEWORK
            </p>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 400,
                fontSize: "clamp(28px, 4vw, 48px)",
                lineHeight: 1.15,
                color: "hsl(var(--green-deep))",
                marginBottom: "20px",
              }}
            >
              Four doors. One mission.
            </h2>
            <p
              className="mx-auto"
              style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontSize: "18px",
                color: "hsl(var(--ink-soft))",
                maxWidth: "640px",
                lineHeight: 1.6,
              }}
            >
              This page is the teaser. Each door leads to its own full explanation.
            </p>
          </div>

          <div className="grid grid-cols-1 min-[880px]:grid-cols-4 gap-6">
            {[
              {
                badge: "LAUNCHING AUGUST 1, 2026",
                eyebrow: "FOR THE FAMILY",
                title: "Eden's Table",
                subtitle: "K-12 Homeschool Curriculum",
                body: "The family doorway. Children learn how God designed their bodies and the plants He gave — alongside the parent who teaches them.",
                cta: "Get the first two weeks free →",
                href: "/homeschool#early-access",
                external: false,
              },
              {
                badge: "FOUNDATIONS LIVE · $97 → $197 ON AUGUST 1",
                eyebrow: "FOR THE ADULT",
                title: "Eden Institute Courses",
                subtitle: "Foundations + Body Systems",
                body: "The parent track. From foundational worldview to terrain-based clinical literacy. Reach genuine clinical competence over time.",
                cta: "See the Courses →",
                href: "/courses",
                external: false,
              },
              {
                badge: "LIVE NOW",
                eyebrow: "FOR THE PRACTITIONER",
                title: "Eden Apothecary",
                subtitle: "Pocket Materia Medica App",
                body: "The tool. Constitutional pattern matching, 100 monograph library, clinical reasoning support. So you don't have to hold it all in your head.",
                cta: "Open the Apothecary →",
                href: "/apothecary/start",
                external: false,
              },
              {
                badge: "AVAILABLE NOW ON AMAZON",
                eyebrow: "WHERE IT STARTED",
                title: "Back to Eden",
                subtitle: "The book where the framework began",
                body: "The origin text — Scripture-anchored herbal healing, written out in full. The work that started everything Eden Institute teaches.",
                cta: "Read the Book →",
                href: "https://www.amazon.com/dp/B0GPW5BZ32?tag=theedeninstit-20",
                external: true,
              },
            ].map((card) => (
              <article
                key={card.title}
                className="flex flex-col bg-white transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]"
                style={{
                  borderRadius: "4px",
                  border: "0.5px solid hsl(var(--sage-border) / 0.6)",
                  borderTop: "3px solid hsl(var(--green-deep))",
                  padding: "32px",
                }}
              >
                <span
                  className="self-start inline-block mb-5"
                  style={{
                    backgroundColor: "hsl(var(--honey) / 0.15)",
                    color: "hsl(var(--honey))",
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 600,
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    padding: "5px 10px",
                    borderRadius: "999px",
                    lineHeight: 1.3,
                  }}
                >
                  {card.badge}
                </span>

                <p
                  className="uppercase mb-3"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 600,
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    color: "hsl(var(--green-mid))",
                  }}
                >
                  {card.eyebrow}
                </p>

                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 500,
                    fontSize: "28px",
                    lineHeight: 1.2,
                    color: "hsl(var(--green-deep))",
                    marginBottom: "6px",
                  }}
                >
                  {card.title}
                </h3>

                <p
                  className="italic mb-4"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "18px",
                    color: "hsl(var(--green-mid))",
                  }}
                >
                  {card.subtitle}
                </p>

                <p
                  className="flex-1"
                  style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: "16px",
                    lineHeight: 1.65,
                    color: "hsl(var(--ink-soft))",
                    marginBottom: "24px",
                  }}
                >
                  {card.body}
                </p>

                <a
                  href={card.href}
                  {...(card.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="self-start inline-flex items-center justify-center transition-colors duration-200 min-h-[44px]"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    letterSpacing: "0.06em",
                    color: "hsl(var(--green-deep))",
                    border: "1px solid hsl(var(--green-deep))",
                    padding: "10px 20px",
                    borderRadius: "2px",
                    backgroundColor: "transparent",
                  }}
                >
                  {card.cta}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="why-this-exists" aria-label="Why this exists">
        <div
          className="px-8"
          style={{
            backgroundColor: "hsl(var(--green-deep))",
            paddingTop: "clamp(60px, 8vw, 120px)",
            paddingBottom: "clamp(60px, 8vw, 120px)",
          }}
        >
          <div className="max-w-[1120px] mx-auto">
            <div className="text-center mb-16">
              <p className="uppercase tracking-[0.18em] mb-6" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: "11px", color: "hsl(var(--honey-pale))"}}>A FRAMEWORK OUR CULTURE FORGOT</p>
              <h2 className="italic mb-6" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.2, color: "hsl(var(--cream))"}}>We outsourced our bodies — and chronic disease is at an all-time high.</h2>
              <p className="mx-auto" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "19px", color: "hsl(var(--sage-pale))", maxWidth: "720px", lineHeight: 1.6}}>Three thousand years of Western clinical herbalism, anchored in Scripture, hasn't disappeared. It just isn't being taught.</p>
            </div>
            <div className="grid grid-cols-1 min-[880px]:grid-cols-2 gap-x-12 gap-y-12 max-w-[960px] mx-auto">
              {[
                {n:"01",h:"The signals were silenced.",b:"Symptoms are information — your body telling you what it needs. A generation was taught to suppress the signal instead of asking what it means."},
                {n:"02",h:"Stewardship became dependency.",b:"The garden, the kitchen, the family table — once where health was tended — were traded for prescriptions and protocols held by people who don't know your name."},
                {n:"03",h:"The framework was forgotten.",b:"Scripture-anchored herbalism. Yahweh as the source of vital force. Western clinical lineage. None of it is gone. It is simply absent from the rooms where children are formed."},
                {n:"04",h:"And the children inherited the gap.",b:"A generation is growing up unable to read their own bodies, unable to name the plants in God's creation, unable to imagine health as anything other than what is prescribed to them."},
              ].map((item) => (
                <div key={item.n}>
                  <div className="italic mb-2" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300, fontSize: "64px", lineHeight: 1, color: "hsl(var(--honey-pale))"}}>{item.n}</div>
                  <h3 className="italic mb-3" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, fontSize: "24px", lineHeight: 1.25, color: "hsl(var(--cream))"}}>{item.h}</h3>
                  <p style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "16px", color: "hsl(var(--sage-pale))", lineHeight: 1.7}}>{item.b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-8" style={{backgroundColor: "hsl(var(--cream-light))", paddingTop: "clamp(60px, 8vw, 120px)", paddingBottom: "clamp(60px, 8vw, 120px)"}}>
          <div className="max-w-[820px] mx-auto text-center">
            <p className="uppercase tracking-[0.18em] mb-6" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: "11px", color: "hsl(var(--green-mid))"}}>A BODY LIKE NO OTHER</p>
            <h2 className="italic mb-12" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.2, color: "hsl(var(--green-deep))"}}>We live in a one-size-fits-all medical system. You were not made one-size-fits-all.</h2>
            <div className="mb-4">
              <div className="mx-auto mb-8" style={{width: "80px", height: "1px", backgroundColor: "hsl(var(--sage-border) / 0.6)"}} />
              <blockquote className="italic mx-auto" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "26px", lineHeight: 1.5, color: "hsl(var(--green-dark))", maxWidth: "720px"}}>"I will give thanks to You, for I am fearfully and wonderfully made… my frame was not hidden from You when I was made in secret, and skillfully wrought."</blockquote>
              <div className="mx-auto mt-8" style={{width: "80px", height: "1px", backgroundColor: "hsl(var(--sage-border) / 0.6)"}} />
            </div>
            <p className="mb-12" style={{fontFamily: "'Caveat', cursive", fontSize: "28px", color: "hsl(var(--honey))", lineHeight: 1.2}}>— Psalm 139:14–15</p>
            <div className="mx-auto" style={{maxWidth: "760px"}}>
              <p style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "18px", color: "hsl(var(--ink))", lineHeight: 1.75, marginBottom: "24px"}}>God did not knit His image in a mold. He knit you — distinctly, deliberately, by hand. Different sizes. Different shapes. Different personalities. Different body patterns. Different responses to heat and cold, stress and stillness, food and feeling.</p>
              <p style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "18px", color: "hsl(var(--ink))", lineHeight: 1.75}}>The plants He designed were not made one-size-fits-all either. The same chamomile that calms one body inflames another. The same elderberry that fortifies one immune system overwhelms another. There is no universal protocol — because there is no universal body.</p>
            </div>
            <p className="italic" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "24px", color: "hsl(var(--green-deep))", marginTop: "40px", lineHeight: 1.4}}>This is where we begin. With your body. Specifically. The one He made.</p>
          </div>
        </div>
        <div className="px-8" style={{backgroundColor: "hsl(var(--cream-warm))", paddingTop: "clamp(60px, 8vw, 120px)", paddingBottom: "clamp(60px, 8vw, 120px)"}}>
          <div className="max-w-[1120px] mx-auto">
            <div className="text-center mb-16">
              <p className="uppercase tracking-[0.18em] mb-6" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: "11px", color: "hsl(var(--green-mid))"}}>BEGIN WHERE YOU ARE</p>
              <h2 className="mb-6" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.2, color: "hsl(var(--green-deep))"}}>Three steps. Free to start.</h2>
              <p className="mx-auto" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "18px", color: "hsl(var(--ink-soft))", maxWidth: "720px", lineHeight: 1.6}}>Find your body's constitutional pattern. Get an herb guide written for you specifically. Source the plants your body is asking for.</p>
            </div>
            <style>{`@media (min-width: 880px) {.three-steps-grid {grid-template-columns: 1fr 0.15fr 1fr 0.15fr 1fr !important; gap: 0 !important;} .three-steps-arrow {display: flex !important;}}`}</style>
            <div className="three-steps-grid grid items-stretch gap-6">
              <StepCard num="1" title="The Pattern Quiz" price="Free · 2 minutes" body="Discover the constitutional pattern God designed you with. No email required to start." ctaLabel="Take the Quiz" ctaHref="/assessment" ctaVariant="honey" />
              <Arrow />
              <StepCard num="2" title="The Deep Dive Guide" price="$4.99" body="Your personalized guide — 10 herbs matched to your pattern, plus nutrition, lifestyle, and Scripture written for you." ctaLabel={hasPattern ? "Unlock with Quiz" : "Take the quiz to unlock →"} ctaHref={hasPattern ? guideUrl : "/assessment"} ctaVariant="outline" />
              <Arrow />
              <StepCard num="3" title="Shop Your Bundle" price="Curated" body="Source the herbs your body is asking for. Curated Amazon bundles, organized by pattern, ready to deliver." ctaLabel={hasPattern && bundleUrl ? "Browse Bundles" : "Take the quiz to unlock →"} ctaHref={hasPattern && bundleUrl ? bundleUrl : "/assessment"} ctaExternal={hasPattern && !!bundleUrl} ctaVariant="outline" />
            </div>
          </div>
        </div>
      </section>

      <section id="founder" aria-label="Founder" className="px-8" style={{backgroundColor: "hsl(var(--cream))", paddingTop: "clamp(60px, 8vw, 120px)", paddingBottom: "clamp(60px, 8vw, 120px)"}}>
        <div className="max-w-[820px] mx-auto text-center">
          <p className="uppercase tracking-[0.18em] mb-6" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: "11px", color: "hsl(var(--green-mid))"}}>FROM THE FOUNDER</p>
          <h2 className="italic mb-8" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, fontSize: "clamp(28px, 3vw, 36px)", lineHeight: 1.3, color: "hsl(var(--green-deep))"}}>"I built this because I couldn't find it. And I needed it to exist."</h2>
          <div className="text-left mx-auto" style={{maxWidth: "720px"}}>
            <p style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "16px", lineHeight: 1.85, color: "hsl(var(--ink))", marginBottom: "20px"}}>I'm Camila — a credentialed teacher with a Master's in education. I spent years studying herbalism formally. Every school I attended was rooted in Far Eastern mysticism — chakras, doshas, energy paradigms I don't share.</p>
            <p style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "16px", lineHeight: 1.85, color: "hsl(var(--ink))", marginBottom: "20px"}}>I didn't want to quit. The plants are real. The clinical lineage of Western herbalism is real. The body's design is real. But I refused to learn it through a paradigm contrary to my faith.</p>
            <p style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "16px", lineHeight: 1.85, color: "hsl(var(--ink))", marginBottom: "20px"}}>So I built a framework that begins with Yahweh — the source of vital force — and threads Scripture through every plant, every body system, every clinical decision. Then I built the curriculum to teach it to children. Then the courses to teach it to adults. Then the app to make the materia medica portable. Then the book where it's all written out.</p>
            <p style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "16px", lineHeight: 1.85, color: "hsl(var(--ink))", marginBottom: "32px"}}>If you've ever picked up an herbal book and quietly noticed Eastern frameworks beneath the surface — this is the alternative you've been waiting for.</p>
          </div>
          <div className="text-right">
            <p style={{fontFamily: "'Caveat', cursive", fontSize: "36px", color: "hsl(var(--green-deep))", lineHeight: 1.2}}>— Camila</p>
            <p className="uppercase mt-2" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, fontSize: "13px", letterSpacing: "0.12em", color: "hsl(var(--ink-soft))"}}>MASTER'S IN EDUCATION · CREDENTIALED TEACHER · FOUNDER, EDEN INSTITUTE</p>
          </div>
        </div>
      </section>

      <GetInvolvedSection />

      <section id="footer" aria-label="Footer" className="px-8" style={{backgroundColor: "hsl(var(--footer-bg))", paddingTop: "clamp(48px, 6vw, 80px)", paddingBottom: "24px"}}>
        <div className="max-w-[1120px] mx-auto">
          <div className="grid grid-cols-1 min-[880px]:grid-cols-4 gap-10">
            <div>
              <p style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, fontSize: "32px", color: "hsl(var(--cream))", lineHeight: 1.2, marginBottom: "8px"}}>Eden Institute</p>
              <p style={{fontFamily: "'Caveat', cursive", fontSize: "22px", color: "hsl(var(--honey))", lineHeight: 1.2, marginBottom: "16px"}}>Back to Eden. Back to Truth.</p>
              <p style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "14px", lineHeight: 1.6, color: "hsl(var(--sage-pale))"}}>The Eden Institute teaches Scripture-anchored, terrain-based clinical herbalism. A framework forgotten by mainstream wellness — taught back, one family at a time. Built by Rooted in Faith Ventures.</p>
            </div>
            <div>
              <p className="uppercase mb-5" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: "11px", letterSpacing: "0.18em", color: "hsl(var(--green-mid))"}}>THE WORK</p>
              <ul className="space-y-3">
                <li><a href="/homeschool" className="inline-flex items-center min-h-[44px]" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "15px", color: "hsl(var(--sage-pale))"}}>Eden's Table</a></li>
                <li><a href="/courses" className="inline-flex items-center min-h-[44px]" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "15px", color: "hsl(var(--sage-pale))"}}>Eden Institute Courses</a></li>
                <li><a href="/apothecary/start" className="inline-flex items-center min-h-[44px]" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "15px", color: "hsl(var(--sage-pale))"}}>Apothecary App</a></li>
                <li><a href="https://www.amazon.com/dp/B0GPW5BZ32?tag=theedeninstit-20" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px]" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "15px", color: "hsl(var(--sage-pale))"}}>The Book</a></li>
              </ul>
            </div>
            <div>
              <p className="uppercase mb-5" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: "11px", letterSpacing: "0.18em", color: "hsl(var(--green-mid))"}}>BEGIN HERE</p>
              <ul className="space-y-3">
                <li><a href="/assessment" className="inline-flex items-center min-h-[44px]" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "15px", color: "hsl(var(--sage-pale))"}}>Pattern Quiz</a></li>
                <li><a href={guideUrl} className="inline-flex items-center min-h-[44px]" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "15px", color: "hsl(var(--sage-pale))"}}>Deep Dive Guide</a></li>
                <li><a href="/homeschool" className="inline-flex items-center min-h-[44px]" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "15px", color: "hsl(var(--sage-pale))"}}>Founders Edition</a></li>
                <li><a href="/why-eden" className="inline-flex items-center min-h-[44px]" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "15px", color: "hsl(var(--sage-pale))"}}>Why Eden</a></li>
              </ul>
            </div>
            <div>
              <p className="uppercase mb-5" style={{fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: "11px", letterSpacing: "0.18em", color: "hsl(var(--green-mid))"}}>CONTACT</p>
              <ul className="space-y-3">
                <li><a href="mailto:hello@edeninstitute.health" className="inline-flex items-center min-h-[44px]" style={{fontFamily: "'EB Garamond', Georgia, serif", fontSize: "15px", color: "hsl(var(--sage-pale))"}}>hello@edeninstitute.health</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center" style={{borderTop: "1px solid hsl(var(--sage-pale) / 0.25)", fontFamily: "'EB Garamond', Georgia, serif", fontSize: "12px", color: "hsl(var(--ink-soft))"}}>
            <span>© 2026 The Eden Institute · Rooted in Faith Ventures · Clarksville, Tennessee</span>
            <span className="hidden sm:inline">|</span>
            <a href="/terms" style={{color: "hsl(var(--ink-soft))"}}>Terms</a>
            <span>·</span>
            <a href="/privacy" style={{color: "hsl(var(--ink-soft))"}}>Privacy</a>
            <span>·</span>
            <a href="/cookies" style={{color: "hsl(var(--ink-soft))"}}>Cookies</a>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Index;
