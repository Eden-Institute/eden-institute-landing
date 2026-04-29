import { useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { GoldDivider } from "@/components/landing/BotanicalAccents";
import { WorldviewBand } from "@/components/landing/WorldviewBand";
import { ROUTES } from "@/lib/routes";

const WhyEden = () => {
  useEffect(() => {
    document.title = "Why Eden Institute — Biblical Clinical Herbalism";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        "There is no other program like this one. Eden Institute offers clinically rigorous, Scripture-anchored herbalism education — free from Eastern spiritual frameworks.",
      );
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />

      {/* HERO */}
      <section className="pt-20 section-padding-lg" style={{ backgroundColor: "hsl(var(--eden-parchment))" }}>
        <div className="eden-container px-6">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <p className="font-accent text-xs tracking-widest uppercase mb-4" style={{ color: "hsl(var(--eden-gold))" }}>
                Why Eden Institute
              </p>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6" style={{ color: "hsl(var(--eden-forest))" }}>
                There Is No Other Program<br />Like This One.
              </h1>
              <p className="font-body text-lg leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.8)" }}>
                And we say that not as a marketing claim — but as a description of reality. Here's what we mean.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <GoldDivider />

      {/* WORLDVIEW BAND — the thesis the page builds out from (Manual v3.17 Lock #14 + #44) */}
      <WorldviewBand caption="What we believe and what we don’t" headline={null} />
      <GoldDivider />

      {/* THE PROBLEM */}
      <section className="section-padding-lg" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="eden-container px-6">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-center mb-10" style={{ color: "hsl(var(--eden-forest))" }}>
                The Christian Herbalism Problem
              </h2>
            </ScrollReveal>
            <div className="grid grid-cols-1 gap-8">
              {[
                { heading: "Most herbal programs are spiritually compromised.", body: "Chakras. Doshas. Moon cycles. Energy fields. These frameworks are borrowed from Hinduism, Buddhism, and paganism — and they appear in mainstream herbalism education with regularity. For a Christian trying to learn herbalism, navigating this is exhausting and often disqualifying." },
                { heading: "Christian-branded programs are often clinically shallow.", body: "There are a handful of programs that call themselves Christian herbalism schools. But most offer little more than folk remedies and Scripture references dropped into otherwise thin content. They don't teach terrain theory, tissue states, or clinical reasoning. They don't prepare you to actually understand what's happening in the body." },
                { heading: "The academic programs don't speak your language.", body: "The rigorous schools — Herbal Academy, Colorado School of Clinical Herbalism, Chestnut — produce excellent graduates. But they are secular institutions. Faith is absent. You learn biochemistry but not stewardship. You learn pharmacognosy but not the Creator behind the plant." },
              ].map((item, i) => (
                <ScrollReveal key={i} delay={i * 100}>
                  <div className="p-6 rounded-sm" style={{ backgroundColor: "hsl(var(--eden-parchment))", border: "1px solid hsl(var(--eden-gold) / 0.2)" }}>
                    <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-forest))" }}>{item.heading}</h3>
                    <p className="font-body text-sm leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.85)" }}>{item.body}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <GoldDivider />

      {/* THE SOLUTION */}
      <section className="section-padding-lg" style={{ backgroundColor: "hsl(var(--eden-parchment))" }}>
        <div className="eden-container px-6">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-center mb-4" style={{ color: "hsl(var(--eden-forest))" }}>
                Eden Institute Is the Answer to All Three.
              </h2>
              <div className="eden-divider mb-10" />
            </ScrollReveal>
            <div className="grid grid-cols-1 gap-8">
              {[
                { label: "Worldview-Anchored", body: "Every framework in our curriculum starts with Yahweh as Creator and ultimate healer. We teach Western clinical herbalism — not Ayurveda, not Traditional Chinese Medicine, not any spiritual framework borrowed from another religion. If you encounter a concept rooted in Eastern spirituality, we name it, explain why we don't use it, and offer the Western clinical equivalent." },
                { label: "Clinically Rigorous", body: "Built on 3,000 years of Western clinical herbalism tradition — Eclectic, Physiomedical, and Vitalist frameworks. Terrain theory. Six tissue states. Constitutional assessment. Body systems literacy. This is not folk medicine dressed up in Scripture. This is serious clinical education with faith as its foundation." },
                { label: "Built by an Educator", body: "Camila holds a Master's in Education and spent years as a credentialed classroom teacher before building Eden Institute. The curriculum architecture, the pedagogical design, the scope and sequence — these are built with the same rigor you'd find in an accredited graduate program. Not a blogger who learned herbs from Pinterest." },
                { label: "Designed for the Christian Family", body: "Our students are mothers, homeschoolers, farmers, and believers who want to care for their families with wisdom and confidence. The curriculum speaks directly to their life, their values, and their calling. Eden's Table extends this education to their children. The community surrounds them with others on the same path." },
              ].map((item, i) => (
                <ScrollReveal key={i} delay={i * 100}>
                  <div className="flex items-start gap-4 p-6 rounded-sm" style={{ backgroundColor: "hsl(var(--eden-cream))", border: "1px solid hsl(var(--eden-gold) / 0.2)" }}>
                    <span className="font-serif text-xl mt-0.5 shrink-0" style={{ color: "hsl(var(--eden-gold))" }}>✦</span>
                    <div>
                      <h3 className="font-serif text-lg font-bold mb-2" style={{ color: "hsl(var(--eden-forest))" }}>{item.label}</h3>
                      <p className="font-body text-sm leading-relaxed" style={{ color: "hsl(var(--eden-bark) / 0.85)" }}>{item.body}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <GoldDivider />

      {/* VS COMPETITORS */}
      <section className="section-padding-lg" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="eden-container px-6">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-center mb-4" style={{ color: "hsl(var(--eden-forest))" }}>
                How We're Different
              </h2>
              <div className="eden-divider mb-10" />
            </ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "Other Programs", items: ["Eastern spiritual frameworks", "Weekend certifications", "Secular foundation", "No clinical depth", "No family application"], negative: true },
                { title: "Eden Institute", items: ["Biblical worldview throughout", "Structured multi-tier curriculum", "Scripture as the anchor", "Clinical terrain theory", "Built for the whole family"], negative: false },
                { title: "Generic Wellness", items: ["No framework at all", "Tips and recipes", "No worldview", "No clinical training", "No community"], negative: true },
              ].map((col, i) => (
                <ScrollReveal key={i} delay={i * 100}>
                  <div className="p-6 rounded-sm h-full" style={{ backgroundColor: col.negative ? "hsl(var(--eden-parchment))" : "hsl(var(--eden-forest))", border: col.negative ? "1px solid hsl(var(--eden-gold) / 0.2)" : "1px solid hsl(var(--eden-gold) / 0.4)" }}>
                    <h3 className="font-serif text-lg font-bold mb-4 text-center" style={{ color: col.negative ? "hsl(var(--eden-bark))" : "hsl(var(--eden-parchment))" }}>
                      {col.title}
                    </h3>
                    <ul className="space-y-3">
                      {col.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 font-body text-sm" style={{ color: col.negative ? "hsl(var(--eden-bark) / 0.7)" : "hsl(var(--eden-parchment) / 0.9)" }}>
                          <span style={{ color: col.negative ? "hsl(var(--eden-bark) / 0.4)" : "hsl(var(--eden-gold))" }}>{col.negative ? "—" : "✦"}</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <GoldDivider />

      {/* FINAL CTA */}
      <section className="section-padding-lg" style={{ backgroundColor: "hsl(var(--eden-parchment))" }}>
        <div className="eden-container px-6">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6" style={{ color: "hsl(var(--eden-forest))" }}>
                Ready to Begin?
              </h2>
              <p className="font-body text-base leading-relaxed mb-8" style={{ color: "hsl(var(--eden-bark) / 0.85)" }}>
                Start with the free body pattern quiz. Two minutes. Eight possible results. It will change how you think about every herb you'll ever use.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/#assessment" className="font-body text-sm font-semibold px-8 py-3 rounded-sm" style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}>
                  Take the Free Body Pattern Quiz →
                </Link>
                <Link to={ROUTES.COURSES} className="font-body text-sm font-semibold px-8 py-3 rounded-sm" style={{ backgroundColor: "transparent", color: "hsl(var(--eden-forest))", border: "1px solid hsl(var(--eden-forest))" }}>
                  View Our Courses
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default WhyEden;
