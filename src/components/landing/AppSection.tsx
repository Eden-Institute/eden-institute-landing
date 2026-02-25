import { useState } from "react";
import { Button } from "@/components/ui/button";
import WaitlistModal from "./WaitlistModal";

const APP_AUDIENCE_ID = "cebd3478-b344-41b7-98c8-8bcf0e0108da";

const tiers = [
  {
    name: "Freemium Tier",
    audience: "FOR HOME HERBALISTS",
    description:
      "Begin your constitutional journey. Introductory assessment, basic herb profiles, and foundational educational content.",
    price: "Free",
    fullPrice: null,
    betaPrice: null,
    betaNote: null,
    dark: false,
  },
  {
    name: "Full Access Tier",
    audience: "FOR SERIOUS STUDENTS",
    description:
      "Deep energetics, constitutional matching, tissue state analysis, and full materia medica access across 100+ herbs.",
    price: null,
    fullPrice: "$19.99/month",
    betaPrice: "$4.99/month during beta",
    betaNote: "Lock in this price for life when you join as a beta tester.",
    dark: false,
  },
  {
    name: "Practitioner Tier",
    audience: "FOR CLINICAL HERBALISTS",
    description:
      "Client profiles, saved constitutions, intelligent herb surfacing based on pattern recognition, and clinical workflow tools.",
    price: null,
    fullPrice: "$99.99/month",
    betaPrice: "$19.99/month during beta",
    betaNote: "Lock in this price for life when you join as a beta tester.",
    dark: true,
  },
];

const AppSection = () => {
  const [appModal, setAppModal] = useState(false);

  return (
    <section id="app" className="section-padding-lg parchment-texture overflow-hidden w-full">
      <div className="eden-container">
        <div className="text-center mb-10 md:mb-16">
          <p className="font-accent text-sm tracking-[0.3em] uppercase gold-text mb-4">
            COMING 2026
          </p>
          <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-2">
            Eden Apothecary
          </h2>
          <p className="font-accent text-lg md:text-xl text-muted-foreground italic mb-4">
            Constitutional Intelligence for Modern Herbalists.
          </p>
          <div className="eden-divider" />
          <p className="font-body text-base md:text-lg text-muted-foreground max-w-3xl mx-auto">
            The Eden Apothecary App is a multi-tiered constitutional assessment and herb matching
            system — from the home kitchen to the clinical practice. Beta testers get locked-in
            discounted pricing for life. Join now before we launch.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12 md:mb-16">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`p-6 md:p-8 lg:p-10 border transition-colors duration-500 ${
                tier.dark
                  ? "border-eden-gold/30"
                  : "bg-card border-border hover:border-eden-gold/40"
              }`}
              style={tier.dark ? { backgroundColor: "#1C3A2E" } : undefined}
            >
              <p
                className="font-accent text-xs tracking-[0.2em] uppercase mb-2"
                style={{ color: "#C9A84C" }}
              >
                {tier.audience}
              </p>
              <h3
                className="font-serif text-xl font-semibold mb-4"
                style={{ color: tier.dark ? "#F5F0E8" : undefined }}
              >
                {tier.name}
              </h3>
              <p
                className={`font-body text-base leading-relaxed mb-6 ${
                  tier.dark ? "" : "text-muted-foreground"
                }`}
                style={tier.dark ? { color: "#F5F0E8", opacity: 0.85 } : undefined}
              >
                {tier.description}
              </p>

              {/* Pricing */}
              {tier.price && (
                <p
                  className="font-serif text-2xl font-bold"
                  style={{ color: tier.dark ? "#C9A84C" : undefined }}
                >
                  {tier.price}
                </p>
              )}
              {tier.fullPrice && (
                <div className="mt-auto">
                  <p
                    className="font-body text-base line-through mb-1"
                    style={{ color: tier.dark ? "#F5F0E8" : undefined, opacity: 0.5 }}
                  >
                    {tier.fullPrice}
                  </p>
                  <p className="font-serif text-xl font-bold" style={{ color: "#C9A84C" }}>
                    {tier.betaPrice}
                  </p>
                  {tier.betaNote && (
                    <p
                      className="font-body text-xs italic mt-2"
                      style={{ color: tier.dark ? "#F5F0E8" : undefined, opacity: 0.7 }}
                    >
                      {tier.betaNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button
            variant="eden"
            size="xl"
            className="w-full md:w-auto"
            onClick={() => setAppModal(true)}
          >
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
