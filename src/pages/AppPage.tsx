import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import WaitlistModal from "@/components/landing/WaitlistModal";
import { Smartphone, Leaf, Shield, Star } from "lucide-react";

const APP_AUD = "cebd3478-b344-41b7-98c8-8bcf0e0108da";
const NAV = [
  { to: "/", label: "Home" },
  { to: "/courses", label: "Courses" },
  { to: "/app", label: "App" },
  { to: "/homeschool", label: "Homeschool" },
  { to: "/community", label: "Community" },
  { to: "/why-eden", label: "Why Eden" },
];

const AppPage = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/40 bg-background sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-xl font-semibold" style={{ color: "hsl(var(--eden-bark))" }}>
            The Eden Institute
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`font-body text-sm transition-colors ${n.to === "/app" ? "font-medium" : "text-muted-foreground hover:text-foreground"}`}
                style={n.to === "/app" ? { color: "hsl(var(--eden-bark))" } : {}}
              >
                {n.label}
              </Link>
            ))}
          </div>
          <Button variant="eden" size="sm" onClick={() => setOpen(true)}>
            Join Beta
          </Button>
        </div>
      </nav>

      <section className="py-20 md:py-28 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-accent text-sm tracking-[0.3em] uppercase mb-6" style={{ color: "hsl(var(--eden-gold))" }}>
            Eden Apothecary
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Your Body Typeal Herb Guide.
            <br />
            <span className="italic">In Your Pocket.</span>
          </h1>
          <div className="w-16 h-px mx-auto my-8" style={{ backgroundColor: "hsl(var(--eden-gold))" }} />
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Eden Apothecary matches herbs to your body type — your body's innate pattern — so you're never
            guessing. Rooted in Biblical terrain medicine. Built for Christian families.
          </p>
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-body mb-8"
            style={{ backgroundColor: "hsl(var(--eden-gold) / 0.12)", color: "hsl(var(--eden-gold))" }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse inline-block"
              style={{ backgroundColor: "hsl(var(--eden-gold))" }}
            />
            Beta launching July 7, 2026
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="eden" size="xl" onClick={() => setOpen(true)}>
              Join the Beta Waitlist
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>
              Built Around Your Body Type
            </h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">
              Eight body types. One personalised herb library. Terrain intelligence, not symptom lookup.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div
              className="rounded-lg p-6 border"
              style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}
            >
              <Smartphone className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Body Type Quiz
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Discover your innate body type in 2 minutes. All 8 types mapped to herbs, tissues, and tendencies.
              </p>
            </div>
            <div
              className="rounded-lg p-6 border"
              style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}
            >
              <Leaf className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Herb Library
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                70+ herbs with terrain intelligence — energetics, tissue affinities, constitutional matches, and safety
                notes.
              </p>
            </div>
            <div
              className="rounded-lg p-6 border"
              style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}
            >
              <Shield className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Biblical Foundation
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                No doshas. No Eastern frameworks. Grounded in creation stewardship and the Five Tenets of Health.
              </p>
            </div>
            <div
              className="rounded-lg p-6 border"
              style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}
            >
              <Star className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Course Integration
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Eden Institute graduates unlock deeper clinical herb data — making the app a living practicum, not just
                a reference.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-4 text-white">Get Early Access</h2>
          <p className="font-body text-lg mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
            Beta opens July 7 alongside the Tier 2 course launch. Founding members get first access and founding pricing
            locked for life.
          </p>
          <Button
            variant="eden-outline"
            size="xl"
            className="border-white text-white hover:bg-white hover:text-foreground"
            onClick={() => setOpen(true)}
          >
            Join the Beta Waitlist
          </Button>
        </div>
      </section>

      <Footer />
      <WaitlistModal open={open} onOpenChange={setOpen} audienceId={APP_AUD} title="Join the Eden Apothecary Beta" />
    </div>
  );
};

export default AppPage;
