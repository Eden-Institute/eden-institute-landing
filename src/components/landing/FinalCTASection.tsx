import { useState } from "react";
import { Button } from "@/components/ui/button";
import WaitlistModal from "./WaitlistModal";

const APP_AUDIENCE_ID = "0ed1f4b6-1b8c-4ef2-b9ca-7a7f67d3f2e6";

const FinalCTASection = () => {
  const [appModal, setAppModal] = useState(false);

  return (
    <section className="section-padding-lg bg-primary">
      <div className="eden-container text-center">
          <p className="font-accent text-sm tracking-[0.3em] uppercase mb-6 font-semibold" style={{ color: '#C9A84C' }}>
            The Eden Institute
          </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 leading-tight" style={{ color: '#C9A84C' }}>
          You Were Not Designed at Random.
        </h2>
        <div className="eden-divider" />
        <p className="font-body text-lg font-semibold max-w-2xl mx-auto mb-12" style={{ color: '#F5F0E8' }}>
          Your constitution, your terrain, your design — they are not accidents. Begin the journey of understanding the body you were given and the plants that were placed for its care.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="https://www.amazon.com/s?k=back+to+eden+series+eden+institute" target="_blank" rel="noopener noreferrer">
            <Button variant="eden-light" size="xl">
              → Explore the Series
            </Button>
          </a>
          <a href="https://www.amazon.com/dp/B0GPW5BZ32" target="_blank" rel="noopener noreferrer">
            <Button variant="eden-gold" size="xl">
              → Purchase Book One
            </Button>
          </a>
          <Button variant="eden-light" size="xl" onClick={() => setAppModal(true)}>
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

export default FinalCTASection;
