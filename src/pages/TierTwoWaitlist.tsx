import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { TierTwoWaitlistForm } from "@/components/landing/TierTwoWaitlistForm";

const PAGE_TITLE = "Tier 2: Body Systems & Clinical Literacy — Coming Soon | The Eden Institute";
const PAGE_DESCRIPTION =
  "Tier 2 — Body Systems & Clinical Literacy — is coming. Start with Tier 1, the Foundations of Constitutional Herbalism, to build the groundwork and be first to hear when Tier 2 opens.";

const TierTwoWaitlist = () => {
  // SEO meta
  useEffect(() => {
    document.title = PAGE_TITLE;

    const ensureMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        el = document.createElement(selector.startsWith("link") ? "link" : "meta") as any;
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    };

    ensureMeta('meta[name="description"]', { name: "description", content: PAGE_DESCRIPTION });
    ensureMeta('meta[property="og:title"]', { property: "og:title", content: PAGE_TITLE });
    ensureMeta('meta[property="og:description"]', { property: "og:description", content: PAGE_DESCRIPTION });
    ensureMeta('link[rel="canonical"]', { rel: "canonical", href: "https://edeninstitute.health/tier-2-waitlist" });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* HERO — Tier 2 deprioritized: "coming soon" + route to Tier 1 (no waitlist). */}
      <section
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-6"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Tier 2 · Coming Soon
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            You've Mastered the Foundation.
            <br />
            <span className="italic">Now Go Clinical.</span>
          </h1>
          <div
            className="w-16 h-px mx-auto my-8"
            style={{ backgroundColor: "hsl(var(--eden-gold))" }}
          />
          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Tier 2 — <em>Body Systems &amp; Clinical Literacy</em> — is coming. The fastest way to be first
            through the door is to start with Tier 1, the foundation it&rsquo;s built on.
          </p>
          <div className="mt-10">
            <a href="#start-tier-1" className="inline-block">
              <Button variant="eden" size="xl" className="whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] h-auto py-3 px-6">
                Start with Tier 1
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* WHAT TIER 2 COVERS */}
      <section className="py-20 px-6 bg-background">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="font-serif text-3xl md:text-4xl font-bold mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Fourteen Modules. 127 Lessons. Every Body System.
          </h2>
          <div
            className="w-16 h-px mx-auto my-6"
            style={{ backgroundColor: "hsl(var(--eden-gold))" }}
          />
          <p className="font-body text-lg leading-relaxed text-muted-foreground">
            Where Tier 1 taught you to read terrain, Tier 2 teaches you to read the body itself. Every major body system —
            digestive, hepatobiliary, cardiovascular, respiratory, nervous, endocrine, immune, urinary, musculoskeletal,
            integumentary, reproductive — studied through a terrain lens with Scripture as the anchor. This is where students
            stop dabbling and start practicing.
          </p>
        </div>
      </section>

      {/* START WITH TIER 1 — the panel (shared with the homepage modal). */}
      <section
        id="start-tier-1"
        className="py-20 md:py-24 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2
              className="font-serif text-3xl md:text-4xl font-bold mb-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Tier 2 Is Coming
            </h2>
            <p className="font-body text-base text-muted-foreground">
              Build the foundation now — and be first in line when it opens.
            </p>
          </div>
          <TierTwoWaitlistForm surface="tier_two_waitlist_page" variant="card" />
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TierTwoWaitlist;
