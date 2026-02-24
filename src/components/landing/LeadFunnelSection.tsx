import { Button } from "@/components/ui/button";
import { useState } from "react";

const LeadFunnelSection = () => {
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder: would integrate with email capture + tagging
    console.log("Lead captured:", { email, interest });
    setEmail("");
    setInterest("");
  };

  return (
    <section className="section-padding-lg bg-secondary">
      <div className="eden-container max-w-2xl">
        <div className="text-center mb-12">
          <p className="font-accent text-sm tracking-[0.3em] uppercase gold-text mb-4">
            Begin Here
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
            Take the Constitution Assessment
          </h2>
          <div className="eden-divider" />
          <p className="font-body text-lg text-muted-foreground">
            Discover your constitutional pattern. Receive tailored guidance on herbs, books, and training aligned to your interest.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border p-8 md:p-12">
          <div>
            <label className="block font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 bg-background border border-border font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-eden-gold transition-colors"
            />
          </div>

          <div>
            <label className="block font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">
              Primary Interest
            </label>
            <select
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border font-body text-foreground focus:outline-none focus:border-eden-gold transition-colors"
            >
              <option value="">Select your focus…</option>
              <option value="books">Books & Reading</option>
              <option value="course">Clinical Herbalism Course</option>
              <option value="app">Eden Apothecary App</option>
              <option value="assessment">Constitution Assessment Only</option>
              <option value="all">Everything — Keep me informed</option>
            </select>
          </div>

          <Button variant="eden" size="xl" className="w-full">
            → Begin the Assessment
          </Button>

          <p className="text-center font-body text-xs text-muted-foreground/60">
            Your data is handled with stewardship. No spam. Unsubscribe anytime.
          </p>
        </form>

        {/* Segmentation logic note for developers */}
        {/* 
          INTEGRATION NOTE: 
          - Capture email + tag users by "interest" field
          - Segment into: Book / Course / App lists
          - Feed assessment results into constitutional profile
          - Allow segmented marketing based on pattern
        */}
      </div>
    </section>
  );
};

export default LeadFunnelSection;
