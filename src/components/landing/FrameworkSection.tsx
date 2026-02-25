import { Button } from "@/components/ui/button";

const axes = [
  {
    icon: "🔥",
    title: "Temperature",
    spectrum: "Hot ↔ Cold",
    description:
      "Every person and every plant carries a thermal signature. Understanding this axis is foundational to constitutional matching — warming herbs for cold constitutions, cooling herbs for excess heat.",
  },
  {
    icon: "💧",
    title: "Fluid",
    spectrum: "Damp ↔ Dry",
    description:
      "The body's fluid terrain reveals patterns of stagnation or depletion. Matching moistening or drying herbs to the person's constitutional tendency restores balance without suppression.",
  },
  {
    icon: "⚡",
    title: "Tone",
    spectrum: "Tense ↔ Relaxed",
    description:
      "Tissue tone governs how the body holds or releases. Tense constitutions require relaxing, yielding herbs. Lax constitutions need astringent, toning support. The plant must match the person.",
  },
];

const FrameworkSection = () => {
  return (
    <section className="section-padding-lg parchment-texture overflow-hidden w-full">
      <div className="eden-container">
        <p className="font-accent text-sm tracking-[0.3em] uppercase gold-text mb-4 text-center">
          The Framework
        </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-4">
          The Three Axes of Constitutional Medicine
        </h2>
        <div className="eden-divider" />

        <p className="font-body text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-16">
          Matching plant to person is the core of biblical herbalism. Every herb and every constitution can be understood through three fundamental axes.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {axes.map((axis) => (
            <div
              key={axis.title}
              className="bg-card border border-border p-8 lg:p-10 text-center group hover:border-eden-gold/40 transition-colors duration-500"
            >
              <span className="text-4xl mb-4 block">{axis.icon}</span>
              <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                {axis.title}
              </h3>
              <p className="font-accent text-sm tracking-[0.2em] uppercase gold-text mb-6">
                {axis.spectrum}
              </p>
              <p className="font-body text-base text-muted-foreground leading-relaxed">
                {axis.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <a href="/assessment">
            <Button variant="eden" size="xl">
              → Take the Assessment
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
};

export default FrameworkSection;
