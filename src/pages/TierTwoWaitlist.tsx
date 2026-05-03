import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { CheckCircle2, Sparkles, Lock } from "lucide-react";
import { TierTwoWaitlistForm } from "@/components/landing/TierTwoWaitlistForm";

const PAGE_TITLE = "Tier 2 Waitlist — The Eden Institute";
const PAGE_DESCRIPTION =
  "Join the free waitlist for Tier 2: Body Systems & Clinical Literacy. Founding members receive a coupon code that drops the price by $1,000 off the public $1,497 price.";

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

      {/* HERO
          PR η fix #3: Tier 2 timing copy updated per Camila's
          2026-05-02 lock. ALL specific dates (Fall 2026, October 8 2026,
          July 7 2026 used as Tier 2 markers) removed and replaced with
          the canonical "Coming 2027" status. Price treatment: $1,497
          public, with a founding member coupon that drops it by $1,000.
          The earlier "$497 founding code valid for 14 days from July 7"
          treatment is dropped — it baked specific dates into the
          messaging that Camila no longer commits to publicly. */}
      <section
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-6"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Tier 2 · Coming 2027 · Free Waitlist
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
            Tier 2 — <em>Body Systems &amp; Clinical Literacy</em> — opens to the public at <strong>$1,497</strong>.
            Join the waitlist for a founding member coupon code that drops the price by <strong>$1,000</strong>.
          </p>
          <div className="mt-10">
            <a
              href="#waitlist-form"
              className="inline-block"
            >
              <Button variant="eden" size="xl" className="whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] h-auto py-3 px-6">
                Reserve My Founding Access
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

      {/* WHAT WAITLIST MEMBERS GET — 3 CARDS */}
      <section
        className="py-20 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="font-accent text-sm tracking-[0.3em] uppercase mb-4"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Founding Member Benefits
            </p>
            <h2
              className="font-serif text-3xl md:text-4xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              What Waitlist Members Get
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <article
              className="rounded-lg p-8 border-2 bg-background"
              style={{ borderColor: "hsl(var(--eden-gold))" }}
            >
              <Sparkles className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>
                First Access
              </h3>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                Waitlist members get early access before the public launch — building clinical literacy while everyone
                else is still waiting in line.
              </p>
            </article>
            <article
              className="rounded-lg p-8 border-2 bg-background"
              style={{ borderColor: "hsl(var(--eden-gold))" }}
            >
              <Lock className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>
                $1,000 Off the Public Price
              </h3>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                Waitlist members receive a founding member coupon code that drops Tier 2 from $1,497 to $497 — a
                $1,000 savings off the public price.
              </p>
            </article>
            <article
              className="rounded-lg p-8 border bg-background"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <CheckCircle2 className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-sage))" }} />
              <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>
                No Obligation
              </h3>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                This is a free waitlist. You're not paying anything today. You're just letting us know you're interested, so we
                can send your founding code when Tier 2 opens.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* EMAIL CAPTURE FORM
          PR η fix #2: form moved to a shared <TierTwoWaitlistForm /> so
          the homepage modal and this page render the same component
          (single source of truth for the EF call shape). The previous
          three-date timeline section was removed because Camila no
          longer commits to specific Tier 2 dates publicly — see the
          status-only "Coming 2027" treatment in the hero. */}
      <section
        id="waitlist-form"
        className="py-20 md:py-24 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2
              className="font-serif text-3xl md:text-4xl font-bold mb-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Join the Free Tier 2 Waitlist
            </h2>
            <p className="font-body text-base text-muted-foreground">
              We'll email you the moment early access opens.
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
