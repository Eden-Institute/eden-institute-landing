import botanicalAccent from "@/assets/botanical-accent.jpg";

const pillars = [
  {
    title: "The Body Was Designed, Not Assembled",
    content:
      "God didn't construct the body like a machine — He breathed life into it. That animating intelligence is still present in every process your body runs without your permission. Healing is not the correction of malfunction. It is the restoration of original design.",
  },
  {
    title: "Every Symptom Is a Signal, Not an Enemy",
    content:
      'Modern medicine was built to suppress. But the body speaks with purpose. Fever, fatigue, inflammation — these are not failures. They are feedback from an intelligent system trying to restore itself. The question is never "how do we stop this?" but "what is this telling us?"',
  },
  {
    title: "You Were Made to Steward, Not Outsource",
    content:
      "Fear disconnects us from the knowledge God embedded in us. You were not designed to be dependent on a system — you were designed to read your own body, match it to God's provision in the plant world, and steward your health as an act of worship.",
  },
];

const TheologicalSection = () => {
  return (
    <section className="section-padding-lg parchment-texture">
      <div className="eden-container">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="font-accent text-sm tracking-[0.3em] uppercase gold-text mb-4">
              Theological Foundation
            </p>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-8 leading-tight">
              Plants Were Placed.
              <br />
              <span className="italic">Not Manufactured.</span>
            </h2>

            <div className="space-y-8">
              {pillars.map((pillar, i) => (
                <div key={i}>
                  <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
                    {pillar.title}
                  </h3>
                  <p className="font-body text-lg text-muted-foreground leading-relaxed">
                    {pillar.content}
                  </p>
                </div>
              ))}
            </div>

            <div className="eden-divider-left mt-10 mb-6" />

            <blockquote className="scripture-block text-xl text-foreground/80 font-accent">
              "Before you reach for any plant — read the person."
            </blockquote>
          </div>

          <div className="flex justify-center lg:sticky lg:top-24">
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
