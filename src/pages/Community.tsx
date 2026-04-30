import { useState } from "react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import WaitlistModal from "@/components/landing/WaitlistModal";
import Navbar from "@/components/landing/Navbar";
import { MapPin, Sprout, Users, BookOpen } from "lucide-react";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

const COMM_AUD = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";

const Community = () => {
  useDocumentMeta({
    title: "The Rooted Community | The Eden Institute",
    description:
      "A private network for homesteaders, homeschool families, and liberty-minded believers building lives connected to the land, the body, and each other.",
    canonical: "https://edeninstitute.health/community",
  });

  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="py-20 md:py-28 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-accent text-sm tracking-[0.3em] uppercase mb-6" style={{ color: "hsl(var(--eden-gold))" }}>
            The Rooted Community
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Faith Families.
            <br />
            <span className="italic">Rooted in the Land.</span>
          </h1>
          <div className="w-16 h-px mx-auto my-8" style={{ backgroundColor: "hsl(var(--eden-gold))" }} />
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            A private network for homesteaders, homeschool families, and liberty-minded believers building lives
            connected to the land, the body, and each other — free from dependence on systems that were never designed
            for their flourishing.
          </p>
          <blockquote className="scripture-block text-sm text-muted-foreground max-w-xl mx-auto mb-10 text-left">
            "They shall build houses and inhabit them; they shall plant vineyards and eat their fruit."
            <footer className="mt-2 text-xs tracking-wider uppercase font-body font-medium not-italic" style={{ color: "hsl(var(--eden-forest))" }}>
              — Isaiah 65:21 (NASB)
            </footer>
          </blockquote>
          <Button variant="eden" size="xl" onClick={() => setOpen(true)}>
            Become a Founding Member
          </Button>
        </div>
      </section>

      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>
              What the Rooted Community Is
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-lg p-6 border" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}>
              <MapPin className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Land and Homestead
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Owner-financed land leads, rural property listings, homesteading skill shares, and land sovereignty
                resources.
              </p>
            </div>
            <div className="rounded-lg p-6 border" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}>
              <Sprout className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Herbal Practice
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Community herb gardens, seasonal planting guides, bulk buying co-ops, and practitioner spotlights.
              </p>
            </div>
            <div className="rounded-lg p-6 border" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}>
              <Users className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Family Network
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Homeschool co-ops, family skill swaps, and local connections for faith-rooted families doing life
                differently.
              </p>
            </div>
            <div className="rounded-lg p-6 border" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}>
              <BookOpen className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Weekly Dispatch
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Curated land news, community spotlights, herb of the week, and liberty updates — every week.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-6 text-white">This Is Not a Facebook Group.</h2>
          <p className="font-body text-lg mb-6 leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
            It's a curated network of serious families who have counted the cost and chosen to build something that
            lasts. No algorithms. No surveillance. No compromised platforms.
          </p>
          <p className="font-body text-base" style={{ color: "rgba(255,255,255,0.7)" }}>
            Founding member pricing is reserved for the waitlist. Once we open, it closes.
          </p>
        </div>
      </section>

      <section className="py-20 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>
            Secure Your Founding Seat
          </h2>
          <p className="font-body text-muted-foreground mb-8">
            We are building toward a 500-person founding cohort. Join the waitlist to be notified the moment founding
            membership opens.
          </p>
          <Button variant="eden" size="xl" onClick={() => setOpen(true)}>
            Join the Founding Waitlist
          </Button>
        </div>
      </section>

      <Footer />
      <WaitlistModal
        open={open}
        onOpenChange={setOpen}
        audienceId={COMM_AUD}
        title="Join the Rooted Community Founding Waitlist"
      />
    </div>
  );
};

export default Community;
