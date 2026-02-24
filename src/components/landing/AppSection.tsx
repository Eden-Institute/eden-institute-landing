import { useState } from "react";
import { Button } from "@/components/ui/button";
import WaitlistModal from "./WaitlistModal";

const APP_AUDIENCE_ID = "0ed1f4b6-1b8c-4ef2-b9ca-7a7f67d3f2e6";

const tiers = [
  {
    name: "Freemium Tier",
    audience: "For Home Herbalists",
    description: "Begin learning constitutional energetics. Introductory assessment, basic herb profiles, and foundational educational content.",
  },
  {
    name: "Full Access Tier",
    audience: "For Serious Students",
    description: "Deep energetics, constitutional matching, tissue state analysis, and full materia medica access across 100+ herbs.",
  },
  {
    name: "Practitioner Tier",
    audience: "For Clinical Herbalists",
    description: "Client profiles, saved constitutions, intelligent herb surfacing based on pattern recognition, and clinical workflow tools.",
  },
];

const AppSection = () => {
  const [appModal, setAppModal] = useState(false);

  return (
    <section className="section-padding-lg parchment-texture">
      <div className="eden-container">
        <div className="text-center mb-16">
          <p className="font-accent text-sm tracking-[0.3em] uppercase gold-text mb-4">
            Coming 2026
          </p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2">
            Eden Apothecary
          </h2>
          <p className="font-accent text-lg md:text-xl text-muted-foreground italic">
            Constitutional Intelligence for Modern Herbalists.
          </p>
          <div className="eden-divider" />
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto">
            The Eden Apothecary App is a multi-tiered constitutional assessment and herb matching system — from the home kitchen to the clinical practice.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16">
          {tiers.map((tier, i) => (
            <div
              key={tier.name}
              className={`p-8 lg:p-10 border transition-colors duration-500 ${
                i === 2
                  ? "bg-primary border-eden-gold/30"
                  : "bg-card border-border hover:border-eden-gold/40"
              }`}
            >
              <p className={`font-accent text-xs tracking-[0.2em] uppercase mb-2 ${i === 2 ? 'text-eden-gold' : 'gold-text'}`}>
                {tier.audience}
              </p>
              <h3 className={`font-serif text-xl font-semibold mb-4 ${i === 2 ? 'text-primary-foreground' : 'text-foreground'}`}>
                {tier.name}
              </h3>
              <p className={`font-body text-base leading-relaxed ${i === 2 ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                {tier.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button variant="eden" size="xl" onClick={() => setAppModal(true)}>
            → Join the App Beta Waitlist
          </Button>
        </div>
      </div>

      <WaitlistModal
        open={appModal}
        onOpenChange={setAppModal}
        audienceId={APP_AUDIENCE_ID}
        title="Join the App Beta Waitlist"
      />
    </section>
  );
};

export default AppSection;
