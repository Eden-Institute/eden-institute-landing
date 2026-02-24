import { Button } from "@/components/ui/button";

const CourseSection = () => {
  return (
    <section className="section-padding-lg bg-primary">
      <div className="eden-container">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-accent text-sm tracking-[0.3em] uppercase text-eden-gold mb-4">
            Clinical Training
          </p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-4">
            Biblical Clinical Herbalism — The Course
          </h2>
          <div className="eden-divider" />

          <p className="font-body text-lg text-primary-foreground/85 leading-relaxed mb-8">
            A structured, multi-tiered clinical herbalism training through a biblical worldview. 100+ herbs. 11 body systems. Constitutional matching. Real pattern recognition.
          </p>

          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            {[
              { number: "100+", label: "Herbs Covered" },
              { number: "11", label: "Body Systems" },
              { number: "3", label: "Constitutional Axes" },
            ].map((stat) => (
              <div key={stat.label} className="border border-primary-foreground/15 p-6">
                <p className="font-serif text-3xl font-bold text-eden-gold mb-1">{stat.number}</p>
                <p className="font-accent text-sm tracking-[0.15em] uppercase text-primary-foreground/60">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <Button variant="eden-light" size="xl">
            → Join Course Waitlist
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CourseSection;
