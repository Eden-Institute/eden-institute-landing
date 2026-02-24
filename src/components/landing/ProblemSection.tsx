const ProblemSection = () => {
  return (
    <section className="section-padding-lg bg-primary">
      <div className="eden-container">
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-8">
          Modern herbalism forgot the framework.
        </h2>

        <div className="eden-divider-left" style={{ background: 'linear-gradient(90deg, hsl(var(--eden-gold)), transparent)' }} />

        <div className="grid md:grid-cols-2 gap-16 mt-12">
          <div>
            <p className="font-body text-lg text-primary-foreground/85 leading-relaxed mb-6">
              Herbalism became "green allopathy" — symptom suppression dressed in natural language, extract obsession stripped of context, and protocol-chasing disconnected from the person.
            </p>
            <p className="font-body text-lg text-primary-foreground/85 leading-relaxed mb-8">
              The Eden Institute restores what was lost:
            </p>

            <ul className="space-y-3">
              {["Constitution", "Terrain", "Energetics", "Stewardship", "Scripture-aligned worldview"].map((item) => (
                <li key={item} className="flex items-center gap-3 font-body text-lg text-primary-foreground/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-eden-gold flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center">
            <blockquote className="scripture-block text-2xl md:text-3xl text-primary-foreground/90 font-accent leading-relaxed" style={{ borderColor: 'hsl(var(--eden-gold))' }}>
              "He causeth the grass to grow for the cattle, and herb for the service of man: that he may bring forth food out of the earth."
              <footer className="mt-4 text-base not-italic tracking-wider uppercase text-primary-foreground/60 font-body">
                — Psalm 104:14
              </footer>
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
