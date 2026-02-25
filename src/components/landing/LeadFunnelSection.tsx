import { useState } from "react";
import { Button } from "@/components/ui/button";
import WaitlistModal from "./WaitlistModal";

const COURSE_AUDIENCE_ID = "4860c1c5-8e2b-4d02-838a-60ef09b789bf";

const LeadFunnelSection = () => {
  const [courseModal, setCourseModal] = useState(false);

  return (
    <section className="section-padding-lg bg-secondary">
      <div className="eden-container max-w-2xl text-center">
        <p className="font-accent text-sm tracking-[0.3em] uppercase gold-text mb-4">
          Begin Here
        </p>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Not Sure Where to Start?

        </h2>
        <div className="eden-divider" />
        <p className="font-accent text-lg md:text-xl text-muted-foreground italic mb-12">
          Start with the book. Understand the framework. Then go deeper.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="https://www.amazon.com/dp/B0GPW5BZ32" target="_blank" rel="noopener noreferrer">
            <Button variant="eden" size="xl">
              → Purchase Book One
            </Button>
          </a>
          <Button variant="eden-outline" size="xl" onClick={() => setCourseModal(true)}>
            → Join the Foundations Course Waitlist
          </Button>
        </div>

        <p className="mt-8 font-body text-xs text-muted-foreground/60">
          Your data is handled with stewardship. No spam. Unsubscribe anytime.
        </p>
      </div>

      <WaitlistModal
        open={courseModal}
        onOpenChange={setCourseModal}
        audienceId={COURSE_AUDIENCE_ID}
        title="Join the Foundations Course Waitlist" />

    </section>);

};

export default LeadFunnelSection;