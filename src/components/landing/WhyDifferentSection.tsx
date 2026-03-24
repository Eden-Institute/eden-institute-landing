import { useState } from "react";
import { Button } from "@/components/ui/button";
import AssessmentModal from "./AssessmentModal";

const pillars = [
  {
    icon: "✦",
    title: "The Body Was Designed, Not Assembled",
    body: "God breathed life into the body. That animating intelligence is still present in every process your body runs without your permission. Healing is not the correction of malfunction — it is the restoration of original design.",
  },
  {
    icon: "✦",
    title: "Every Symptom Is a Signal, Not an Enemy",
    body: "The body speaks with purpose. Fever, fatigue, inflammation — these are not failures. They are feedback from an intelligent system trying to restore itself toward God's original design.",
  },
  {
    icon: "✦",
    title: "You Were Made to Steward, Not Outsource",
    body: "You were not designed to be dependent on a system. You were designed to read your own body, match it to God's provision in the plant world, and steward your health as an act of worship.",
  },
];

const WhyDifferentSection = () => {
  const [assessmentModal, setAssessmentModal] = useState(false);

  return (
    <section id="foundation" className="section-padding-lg overflow-hidden w-full" style={{ backgroundColor: "#1C3A2E" }}>
      <div className="eden-container">
        <div className="text-center mb-10 md:mb-16">
          <p className="font-accent text-sm tracking-[0.3em] uppercase mb-4" style={{ color: "#C9A84C" }}>
            THE FRAMEWORK
          </p>
          <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4" style={{ color: "#F5F0E8" }}>
            Three Things Modern Herbalism Forgot
          </h2>
          <div className="eden-divider" />
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 mb-12 md:mb-16">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="text-center">
              <span className="text-2xl mb-4 block" style={{ color: "#C9A84C" }}>
                {pillar.icon}
              </span>
              <h3 className="font-serif text-lg md:text-xl font-semibold mb-4" style={{ color: "#C9A84C" }}>
                {pillar.title}
              </h3>
              <p className="font-body text-base leading-relaxed font-medium" style={{ color: "#F5F0E8" }}>
                {pillar.body}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button
            variant="eden-gold"
            size="xl"
            className="w-full md:w-auto max-w-[90vw] mx-auto text-[12px] md:text-sm whitespace-normal box-border"
            onClick={() => setAssessmentModal(true)}
          >
            Find Out How Your Body Works — Take the Free Quiz (2 min)
          </Button>
        </div>
      </div>

      <AssessmentModal open={assessmentModal} onOpenChange={setAssessmentModal} />
    </section>
  );
};

export default WhyDifferentSection;
