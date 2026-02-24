import botanicalAccent from "@/assets/botanical-accent.jpg";

const TheologicalSection = () => {
  return (
    <section className="section-padding-lg parchment-texture">
      <div className="eden-container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="font-accent text-sm tracking-[0.3em] uppercase gold-text mb-4">
              Theological Foundation
            </p>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-8 leading-tight">
              Plants Were Placed.
              <br />
              <span className="italic">Not Manufactured.</span>
            </h2>

            <div className="space-y-6 font-body text-lg text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">The Whole Plant Doctrine.</strong> The herb is not a delivery mechanism for an isolated compound. It is a designed whole — complex, synergistic, and intentional. Reduction is not understanding; it is dismemberment.
              </p>
              <p>
                <strong className="text-foreground">Complexity as Design.</strong> The hundreds of constituents within a single plant are not random. They are architecture. They speak to the wisdom of a Creator who placed each herb for the service of man.
              </p>
              <p>
                <strong className="text-foreground">Stewardship Over Suppression.</strong> The goal of biblical herbalism is not to silence symptoms. It is to read the body's language, understand its terrain, and steward it toward the design it was made for.
              </p>
            </div>

            <div className="eden-divider-left mt-10 mb-6" />

            <blockquote className="scripture-block text-xl text-foreground/80 font-accent">
              "Before you reach for any plant — read the person."
            </blockquote>
          </div>

          <div className="flex justify-center">
            <img
              src={botanicalAccent}
              alt="Botanical engraving illustration"
              className="w-full max-w-sm opacity-80 mix-blend-multiply"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default TheologicalSection;
