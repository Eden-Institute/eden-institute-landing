import { Button } from "@/components/ui/button";

const FinalCTASection = () => {
  return (
    <section className="section-padding-lg bg-primary">
      <div className="eden-container text-center">
        <p className="font-accent text-sm tracking-[0.3em] uppercase text-eden-gold mb-6">
          The Eden Institute
        </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-4 leading-tight">
          You Were Not Designed at Random.
        </h2>
        <div className="eden-divider" />
        <p className="font-body text-lg text-primary-foreground/70 max-w-2xl mx-auto mb-12">
          Your constitution, your terrain, your design — they are not accidents. Begin the journey of understanding the body you were given and the plants that were placed for its care.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="eden-light" size="xl">
            → Take the Constitution Assessment
          </Button>
          <Button variant="eden-gold" size="xl">
            → Purchase Book One
          </Button>
          <Button variant="eden-light" size="xl">
            → Join the App Waitlist
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FinalCTASection;
