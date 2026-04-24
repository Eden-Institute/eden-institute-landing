import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTier } from "@/hooks/useCurrentTier";

const TENETS: { name: string; description: string }[] = [
  {
    name: "Hydration",
    description:
      "Living water — the first substrate of every tissue and the vehicle of every clearance.",
  },
  {
    name: "Nutrition",
    description:
      "Whole-food nourishment — the raw material of repair and the fuel of every system.",
  },
  {
    name: "Respiration",
    description:
      "Breath — the oldest scripture of the body, carrying oxygen to every cell.",
  },
  {
    name: "Circulation",
    description:
      "Movement of blood and lymph — the traffic of repair, warmth, and clearance.",
  },
  {
    name: "Elimination",
    description:
      "Stool, urine, sweat, breath — the four gates of clearance; stewardship begins here.",
  },
];

export default function ApothecaryHome() {
  const { user } = useAuth();
  const { data: tier } = useCurrentTier();

  const isAuthed = !!user;
  const isSubscriber =
    tier === "seed" || tier === "root" || tier === "practitioner";

  return (
    <div>
      <section
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-6"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Eden Apothecary
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Terrain-first
            <br />
            <span className="italic">clinical reasoning.</span>
          </h1>
          <div
            className="w-16 h-px mx-auto my-8"
            style={{ backgroundColor: "hsl(var(--eden-gold))" }}
          />
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Eden Apothecary assesses the person's terrain first, then matches
            herbs to constitutional patterns — not symptoms. A clinical
            reasoning partner grounded in the Five Tenets and the Biblical
            framework of creation stewardship.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!isAuthed && (
              <>
                <Button variant="eden" size="xl" asChild>
                  <Link to="/apothecary/auth/signup">
                    Create a free account
                  </Link>
                </Button>
                <Button variant="eden-outline" size="xl" asChild>
                  <Link to="/apothecary/pricing">View plans</Link>
                </Button>
              </>
            )}
            {isAuthed && !isSubscriber && (
              <Button variant="eden" size="xl" asChild>
                <Link to="/apothecary/pricing">Choose a plan</Link>
              </Button>
            )}
            {isAuthed && isSubscriber && (
              <Button variant="eden" size="xl" asChild>
                <Link to="/apothecary/pricing">Manage subscription</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-4"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              The Five Tenets
            </p>
            <h2
              className="font-serif text-3xl font-bold mb-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              What we steward
            </h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">
              The physiological outputs that reveal the health of the terrain.
              Every recommendation in the Apothecary anchors to one or more
              tenets plus a pattern — never to a symptom.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {TENETS.map((t) => (
              <div
                key={t.name}
                className="rounded-lg p-5 border"
                style={{
                  borderColor: "hsl(var(--border))",
                  backgroundColor: "hsl(var(--eden-cream) / 0.4)",
                }}
              >
                <h3
                  className="font-serif text-base font-semibold mb-2"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  {t.name}
                </h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">
                  {t.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
