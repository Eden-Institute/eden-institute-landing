import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import WaitlistModal from "@/components/landing/WaitlistModal";

const COURSE_AUDIENCE_ID = "4860c1c5-8e2b-4d02-838a-60ef09b789bf";

interface Question {
  id: number;
  axis: "temperature" | "fluid" | "tone";
  question: string;
  options: { label: string; text: string; score: string }[];
}

const questions: Question[] = [
  {
    id: 1, axis: "temperature",
    question: "How would you describe your body temperature in everyday life?",
    options: [
      { label: "A", text: "I run warm — I often feel too hot, prefer cool rooms, and kick off blankets at night", score: "Hot" },
      { label: "B", text: "I run cool — I'm often the coldest person in the room and love warming up", score: "Cold" },
      { label: "C", text: "It varies a lot — sometimes hot, sometimes cold, hard to pin down", score: "neutral" },
      { label: "D", text: "I don't notice much either way", score: "neutral" },
    ],
  },
  {
    id: 2, axis: "temperature",
    question: "When you're under stress or overwhelmed, what happens to your body?",
    options: [
      { label: "A", text: "I get hot, flushed, or feel heat in my chest and face", score: "Hot" },
      { label: "B", text: "I get cold, stiff, or feel chilled and want to bundle up", score: "Cold" },
      { label: "C", text: "I get sweaty but also cold at the same time", score: "neutral" },
      { label: "D", text: "My temperature doesn't change much", score: "neutral" },
    ],
  },
  {
    id: 3, axis: "temperature",
    question: "How do you feel after eating a large, rich, or heavy meal?",
    options: [
      { label: "A", text: "Uncomfortable, overly warm, or nauseous", score: "Hot" },
      { label: "B", text: "Better — a warm meal genuinely helps me", score: "Cold" },
      { label: "C", text: "Sluggish and sleepy regardless", score: "neutral" },
      { label: "D", text: "Depends on the food", score: "neutral" },
    ],
  },
  {
    id: 4, axis: "temperature",
    question: "What kind of weather feels best to your body?",
    options: [
      { label: "A", text: "Cool or cold weather", score: "Hot" },
      { label: "B", text: "Warm or hot weather", score: "Cold" },
      { label: "C", text: "Mild seasons", score: "neutral" },
      { label: "D", text: "No strong preference", score: "neutral" },
    ],
  },
  {
    id: 5, axis: "fluid",
    question: "How would you describe your skin and mucous membranes?",
    options: [
      { label: "A", text: "Oily skin, prone to breakouts, mucus congestion", score: "Damp" },
      { label: "B", text: "Dry skin, dry eyes, dry mouth, tendency toward dehydration", score: "Dry" },
      { label: "C", text: "Combination", score: "neutral" },
      { label: "D", text: "Normal", score: "neutral" },
    ],
  },
  {
    id: 6, axis: "fluid",
    question: "How does your body handle respiratory illness?",
    options: [
      { label: "A", text: "Lots of mucus, congestion, runny nose, phlegm", score: "Damp" },
      { label: "B", text: "Dry, tight, unproductive symptoms — dry cough", score: "Dry" },
      { label: "C", text: "Varies by illness", score: "neutral" },
      { label: "D", text: "Don't get sick often enough to notice", score: "neutral" },
    ],
  },
  {
    id: 7, axis: "fluid",
    question: "Which best describes your digestion?",
    options: [
      { label: "A", text: "Loose, sluggish, prone to bloating — I retain water easily", score: "Damp" },
      { label: "B", text: "Dry, constipated, prone to hard stools", score: "Dry" },
      { label: "C", text: "Irregular — alternates", score: "neutral" },
      { label: "D", text: "Generally normal", score: "neutral" },
    ],
  },
  {
    id: 8, axis: "fluid",
    question: "How would you describe your body type?",
    options: [
      { label: "A", text: "I gain weight easily, retain fluid, soft or puffy tissue", score: "Damp" },
      { label: "B", text: "I stay lean naturally, dry out easily, firm tissue", score: "Dry" },
      { label: "C", text: "I fluctuate", score: "neutral" },
      { label: "D", text: "Don't strongly identify with either", score: "neutral" },
    ],
  },
  {
    id: 9, axis: "tone",
    question: "How does your nervous system respond to stress?",
    options: [
      { label: "A", text: "I tighten up — shoulders, jaw, gut clench and it's hard to let go", score: "Tense" },
      { label: "B", text: "I go soft or spacey — scattered, loose, lose focus", score: "Relaxed" },
      { label: "C", text: "I swing between the two", score: "neutral" },
      { label: "D", text: "I stay pretty even", score: "neutral" },
    ],
  },
  {
    id: 10, axis: "tone",
    question: "Where do you feel tension most often?",
    options: [
      { label: "A", text: "Tight muscles, clenched jaw, tension headaches, cramping", score: "Tense" },
      { label: "B", text: "Weakness, sagging feeling, poor muscle tone, heaviness", score: "Relaxed" },
      { label: "C", text: "Pain that moves — sometimes tight, sometimes loose", score: "neutral" },
      { label: "D", text: "No consistent pattern", score: "neutral" },
    ],
  },
  {
    id: 11, axis: "tone",
    question: "How would you describe your sleep?",
    options: [
      { label: "A", text: "Hard to fall asleep — mind won't stop, body feels wound up", score: "Tense" },
      { label: "B", text: "Fall asleep easily but sleep too deeply — hard to feel rested", score: "Relaxed" },
      { label: "C", text: "Inconsistent", score: "neutral" },
      { label: "D", text: "Sleep normally", score: "neutral" },
    ],
  },
  {
    id: 12, axis: "tone",
    question: "How do your emotions express in your body?",
    options: [
      { label: "A", text: "Intense — I feel things strongly, shows up as tension, heat, or pain", score: "Tense" },
      { label: "B", text: "Porous — I absorb others' energy and feel drained or loose", score: "Relaxed" },
      { label: "C", text: "I bottle things up until I crash", score: "neutral" },
      { label: "D", text: "I process emotions smoothly", score: "neutral" },
    ],
  },
];

interface ConstitutionProfile {
  nickname: string;
  description: string[];
  herbs: { name: string; note: string }[];
}

const constitutionProfiles: Record<string, ConstitutionProfile> = {
  "Hot / Dry / Tense": {
    nickname: "The Burning Bowstring",
    description: [
      "You are a person of intensity. Your body runs hot, your tissues tend toward dryness, and your nervous system holds tension like a drawn bow. You may experience sharp headaches, tight muscles, dry skin, and a tendency toward irritability or insomnia. Your metabolism burns fast, and you may find yourself depleted if you don't slow down.",
      "This constitution is common among driven, high-energy individuals who push hard and crash harder. Your body needs cooling, moistening, and relaxing support — not more stimulation. The herbs that serve you best are those that soften the edges, replenish lost fluids, and calm the fire without extinguishing your vitality.",
      "Your path to wellness involves learning to yield — to rest before you're forced to, to hydrate before you're parched, and to release tension before it becomes pain. You were designed for endurance, but endurance requires rhythm, not relentless output.",
    ],
    herbs: [
      { name: "Marshmallow Root", note: "Deeply moistening and soothing to dry, inflamed tissues throughout the body." },
      { name: "Passionflower", note: "Calms an overactive mind and releases muscular tension without sedation." },
      { name: "Lemon Balm", note: "Gently cooling and nervine, easing heat-driven anxiety and restlessness." },
      { name: "Chamomile", note: "Anti-inflammatory and relaxing, especially for tension held in the gut." },
      { name: "Violet Leaf", note: "Cooling and moistening, softening dry, tight tissue states." },
    ],
  },
  "Hot / Dry / Relaxed": {
    nickname: "The Open Flame",
    description: [
      "You burn bright but without the tension to hold it in — your heat disperses freely. You run warm, tend toward dryness, and your tissues lack tone. You may experience scattered energy, dry skin and membranes, and a feeling of being 'burnt out' despite not feeling wound up.",
      "This is the constitution of someone who gives freely — perhaps too freely. Your fire is real, but without structural support, it dissipates. You need herbs that cool and moisten while also providing gentle toning to give your body something to hold onto.",
      "Your healing journey is about containment without restriction — learning to direct your warmth purposefully rather than letting it radiate without boundary. Nourishing, building herbs paired with gentle astringents will help you maintain your fire without losing yourself in it.",
    ],
    herbs: [
      { name: "Shatavari", note: "Deeply nourishing and moistening, rebuilding depleted fluids and vitality." },
      { name: "Rose", note: "Gently cooling and mildly astringent, restoring tone to lax, dry tissues." },
      { name: "Hibiscus", note: "Cooling and hydrating with mild astringency to support tissue integrity." },
      { name: "Licorice Root", note: "Moistening and restorative, supporting adrenal function and fluid balance." },
      { name: "Aloe Vera", note: "Cooling, moistening, and soothing to internal and external dry heat." },
    ],
  },
  "Hot / Damp / Tense": {
    nickname: "The Pressure Cooker",
    description: [
      "You hold heat and fluid simultaneously, and your body is wound tight. This creates a feeling of internal pressure — like steam building with no release valve. You may experience bloating alongside inflammation, acne or skin eruptions, headaches, and a short fuse emotionally.",
      "This is one of the most intense constitutional patterns. Your body is trying to move things — heat, fluid, waste — but tension prevents proper flow. The result is stagnation that manifests as pressure, swelling, and irritability. You need herbs that open channels, cool excess heat, and release both physical and emotional tension.",
      "Your work is to create outlets — not through force, but through gentle, consistent release. Movement, bitter herbs, and nervines that don't add more heat are your allies. When the pressure releases, you'll find remarkable energy and clarity underneath.",
    ],
    herbs: [
      { name: "Dandelion Root", note: "Bitter, cooling, and draining — supports liver function and reduces damp heat." },
      { name: "Skullcap", note: "Nervine relaxant that cools and calms without adding moisture." },
      { name: "Burdock Root", note: "Alterative and cooling, clearing damp heat through the skin and lymph." },
      { name: "Milk Thistle", note: "Liver-protective and cooling, helping process excess heat and stagnation." },
      { name: "Cramp Bark", note: "Antispasmodic that releases tension in muscles and smooth muscle tissue." },
    ],
  },
  "Hot / Damp / Relaxed": {
    nickname: "The Overflowing Cup",
    description: [
      "You run warm, your body holds excess moisture, and your tissues lack tone — like a cup filled past its brim. You may experience water retention, loose stools, excessive sweating, sluggish digestion, and a general feeling of heaviness despite your internal warmth.",
      "This constitution often shows up as someone who feels weighed down by their own abundance. There's heat driving processes, but without tone to contain them, everything overflows. Skin may be oily, digestion loose, and energy erratic — bursts of warmth followed by heavy crashes.",
      "Your path involves drying, cooling, and toning simultaneously. Astringent herbs that tighten lax tissues, bitter herbs that clear damp heat, and gentle stimulants that improve sluggish elimination will help you find your edges again.",
    ],
    herbs: [
      { name: "Yarrow", note: "Cooling, drying, and astringent — restores tone while clearing excess heat." },
      { name: "Sage", note: "Drying and mildly astringent, reduces excessive sweating and dampness." },
      { name: "Green Tea", note: "Gently stimulating, antioxidant-rich, and astringent for lax, damp tissues." },
      { name: "Oregon Grape Root", note: "Bitter and cooling, clears damp heat from the gut and skin." },
      { name: "Raspberry Leaf", note: "Nutritive and astringent, toning lax tissues throughout the body." },
    ],
  },
  "Cold / Dry / Tense": {
    nickname: "The Drawn Bowstring",
    description: [
      "You are cold, dry, and tightly wound — like a bow drawn but never released. Your body feels contracted, your skin and membranes are parched, and you may carry chronic tension in your neck, shoulders, and gut. Anxiety, constipation, and poor circulation are common companions.",
      "This is the constitution of someone who holds everything in. You conserve energy to the point of stagnation, and your body reflects that withholding. Joints may feel stiff, digestion sluggish and dry, and emotions tightly controlled until they break through unpredictably.",
      "Your healing lies in warmth, moisture, and gentle release. You need herbs that kindle your internal fire, soften dried-out tissues, and slowly coax your nervous system out of its guarded posture. Nourishing warmth — not aggressive stimulation — is the key.",
    ],
    herbs: [
      { name: "Ashwagandha", note: "Warming, moistening adaptogen that nourishes depleted, tense constitutions." },
      { name: "Cinnamon", note: "Gently warming and stimulating to cold, stagnant circulation." },
      { name: "Marshmallow Root", note: "Deeply moistening, softening dry, constricted tissues from within." },
      { name: "Milky Oat Tops", note: "Nervine trophorestorative that rebuilds an exhausted, tense nervous system." },
      { name: "Ginger", note: "Warming and stimulating to sluggish, cold digestion and circulation." },
    ],
  },
  "Cold / Dry / Relaxed": {
    nickname: "The Spent Candle",
    description: [
      "You are depleted across all three axes — cold, dry, and without tone. Like a candle that has burned down to a stub, your reserves are low. You may feel perpetually tired, chilly, dehydrated, and lacking the structural integrity to hold yourself together through the day.",
      "This is often the constitution of deep exhaustion — someone who has given more than they had for too long. The body has lost its warmth, its moisture, and its resilience. Skin is dry and thin, digestion weak, energy low, and recovery slow. Everything feels like it takes more effort than it should.",
      "Your path is the most gentle of all — slow, steady rebuilding. Warming, moistening, and toning herbs taken consistently over time will gradually restore what was lost. This is not a constitution that responds to quick fixes. It responds to faithful, patient nourishment.",
    ],
    herbs: [
      { name: "Shatavari", note: "Deeply nourishing, warming, and moistening — rebuilds depleted vitality." },
      { name: "Astragalus", note: "Warming and tonifying, strengthening immunity and deep energy reserves." },
      { name: "Licorice Root", note: "Moistening, warming, and restorative to exhausted adrenals and dry tissues." },
      { name: "Rehmannia", note: "Blood-building and deeply moistening for chronic dryness and depletion." },
      { name: "Bone Broth Herbs (Nettle, Oatstraw)", note: "Mineral-rich and gently building, restoring structural integrity over time." },
    ],
  },
  "Cold / Damp / Tense": {
    nickname: "The Frozen River",
    description: [
      "You are cold and waterlogged, but held rigidly in place — like a river frozen mid-flow. Your body retains fluid but can't move it. You may experience cold hands and feet, swelling, sinus congestion, tight muscles, and a feeling of being stuck — physically and emotionally.",
      "This constitution combines stagnation with rigidity. The cold slows everything down, the dampness accumulates, and the tension prevents release. You may feel heavy, sluggish, and anxious simultaneously. Digestion is often slow with bloating, and your body may ache from the combination of cold, fluid, and tightness.",
      "Your healing requires a careful balance: gentle warming to thaw the cold, drying herbs to reduce accumulation, and antispasmodics to release the tension that keeps everything locked in place. Movement — physical and herbal — is essential. You need to flow again.",
    ],
    herbs: [
      { name: "Ginger", note: "Warming and drying, stimulating sluggish circulation and digestion." },
      { name: "Juniper Berry", note: "Warming, drying, and diuretic — moves stagnant fluid and relieves congestion." },
      { name: "Rosemary", note: "Warming and stimulating to cold, tense, stagnant tissue states." },
      { name: "Valerian", note: "Warming antispasmodic that releases deep-held muscular and nervous tension." },
      { name: "Angelica Root", note: "Warming and aromatic, moving stagnant blood and fluid in cold constitutions." },
    ],
  },
  "Cold / Damp / Relaxed": {
    nickname: "The Still Pond",
    description: [
      "You are the most yin of all constitutional types — cold, damp, and relaxed. Like a still pond, there is depth but little movement. Your body retains fluid easily, runs cool, and lacks the muscular and nervous tone to drive vigorous circulation or elimination. You may feel heavy, foggy, and slow to start.",
      "This constitution often manifests as weight gain, chronic congestion, fatigue, and a tendency to feel emotionally waterlogged — absorbing everything around you without clear boundaries. Digestion is sluggish, metabolism slow, and motivation can feel elusive despite genuine desire.",
      "Your path is activation — but gentle, sustained activation, not aggressive stimulation. Warming, drying, and toning herbs will help you metabolize what's accumulated and build the internal fire needed to move stagnant energy. Consistent daily practice with these herbs, paired with gentle movement, will gradually restore your vitality.",
    ],
    herbs: [
      { name: "Cinnamon", note: "Warming and drying, kindling metabolic fire in cold, damp constitutions." },
      { name: "Turmeric", note: "Warming, drying, and anti-inflammatory — moves stagnation and reduces dampness." },
      { name: "Sage", note: "Drying and astringent, toning lax tissues and reducing excess moisture." },
      { name: "Eleuthero", note: "Warming adaptogen that builds sustained energy without overstimulation." },
      { name: "Thyme", note: "Warming, drying, and antimicrobial — clears damp congestion from lungs and gut." },
    ],
  },
};

function computeResult(answers: Record<number, string>) {
  const axes = {
    temperature: { first: "Hot", second: "Cold", questions: [1, 2, 3, 4] },
    fluid: { first: "Damp", second: "Dry", questions: [5, 6, 7, 8] },
    tone: { first: "Tense", second: "Relaxed", questions: [9, 10, 11, 12] },
  };

  const results: string[] = [];

  for (const axis of Object.values(axes)) {
    let firstCount = 0;
    let secondCount = 0;
    for (const qId of axis.questions) {
      const score = answers[qId];
      if (score === axis.first) firstCount++;
      if (score === axis.second) secondCount++;
    }
    results.push(firstCount >= secondCount ? axis.first : axis.second);
  }

  return results.join(" / ");
}

const Assessment = () => {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [phase, setPhase] = useState<"quiz" | "gate" | "results">("quiz");
  const [transitioning, setTransitioning] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [courseModal, setCourseModal] = useState(false);

  const constitutionType = phase !== "quiz" ? computeResult(answers) : "";
  const profile = constitutionType ? constitutionProfiles[constitutionType] : null;

  const handleAnswer = useCallback((questionId: number, score: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
    setTransitioning(true);
    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ((prev) => prev + 1);
      } else {
        setPhase("gate");
      }
      setTransitioning(false);
    }, 400);
  }, [currentQ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("resend-waitlist", {
        body: {
          firstName,
          email,
          audienceId: COURSE_AUDIENCE_ID,
          constitutionType,
          source: "constitution_assessment",
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setPhase("results");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const q = questions[currentQ];
  const progress = phase === "quiz" ? ((currentQ + (answers[q.id] ? 1 : 0)) / questions.length) * 100 : 100;

  const axisLabel = q.axis === "temperature" ? "Temperature Axis" : q.axis === "fluid" ? "Fluid Axis" : "Tone Axis";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      {/* Header */}
      <header className="px-6 py-6 border-b" style={{ borderColor: "hsl(40, 20%, 80%)" }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <a href="/" className="font-serif text-lg font-bold" style={{ color: "#1C3A2E" }}>
            The Eden Institute
          </a>
          <span className="font-accent text-sm tracking-[0.2em] uppercase" style={{ color: "#C9A84C" }}>
            Constitutional Assessment
          </span>
        </div>
      </header>

      {phase === "quiz" && (
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Progress */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <span className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "#C9A84C" }}>
                {axisLabel}
              </span>
              <span className="font-body text-sm" style={{ color: "#1C3A2E" }}>
                Question {currentQ + 1} of {questions.length}
              </span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: "hsl(40, 20%, 80%)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: "#C9A84C" }}
              />
            </div>
          </div>

          {/* Question */}
          <div
            className={`transition-all duration-400 ${transitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}
          >
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8" style={{ color: "#1C3A2E" }}>
              {q.question}
            </h2>

            <div className="space-y-4">
              {q.options.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleAnswer(q.id, opt.score)}
                  className="w-full text-left p-5 border-2 rounded transition-all duration-200 hover:border-[#C9A84C] hover:shadow-md group"
                  style={{
                    borderColor: answers[q.id] === opt.score ? "#C9A84C" : "hsl(40, 20%, 80%)",
                    backgroundColor: answers[q.id] === opt.score ? "hsl(40, 55%, 50%, 0.08)" : "white",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-serif font-bold text-sm border-2 group-hover:border-[#C9A84C] group-hover:text-[#C9A84C] transition-colors"
                      style={{
                        borderColor: answers[q.id] === opt.score ? "#C9A84C" : "#1C3A2E",
                        color: answers[q.id] === opt.score ? "#C9A84C" : "#1C3A2E",
                      }}
                    >
                      {opt.label}
                    </span>
                    <span className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>
                      {opt.text}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "gate" && profile && (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>
            Your Constitutional Type
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-bold mt-4 mb-2" style={{ color: "#1C3A2E" }}>
            {constitutionType}
          </h2>
          <p className="font-accent text-xl italic mb-8" style={{ color: "#C9A84C" }}>
            "{profile.nickname}"
          </p>
          <p className="font-body text-lg mb-12 leading-relaxed" style={{ color: "#1C3A2E" }}>
            {profile.description[0].substring(0, 120)}…
          </p>

          <div className="p-8 border rounded" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
            <h3 className="font-serif text-xl font-bold mb-2" style={{ color: "#1C3A2E" }}>
              Get Your Full Constitutional Profile
            </h3>
            <p className="font-body text-sm mb-6" style={{ color: "hsl(30, 10%, 40%)" }}>
              Enter your name and email to receive your full constitutional profile and personalized herb recommendations.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(30, 10%, 40%)" }}>
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="Your first name"
                  className="w-full px-4 py-3 border font-body focus:outline-none transition-colors"
                  style={{ borderColor: "hsl(40, 20%, 80%)", color: "#1C3A2E", backgroundColor: "#F5F0E8" }}
                />
              </div>
              <div>
                <label className="block font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(30, 10%, 40%)" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border font-body focus:outline-none transition-colors"
                  style={{ borderColor: "hsl(40, 20%, 80%)", color: "#1C3A2E", backgroundColor: "#F5F0E8" }}
                />
              </div>
              {error && <p className="font-body text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                variant="eden"
                size="xl"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Submitting…" : "→ Send Me My Results"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {phase === "results" && profile && (
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <p className="font-body text-sm mb-4" style={{ color: "#C9A84C" }}>
              ✓ Your results are on their way. Check your inbox.
            </p>
            <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>
              Your Constitutional Type
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-bold mt-4 mb-2" style={{ color: "#1C3A2E" }}>
              {constitutionType}
            </h1>
            <p className="font-accent text-2xl italic" style={{ color: "#C9A84C" }}>
              "{profile.nickname}"
            </p>
          </div>

          <div className="space-y-6 mb-16">
            {profile.description.map((para, i) => (
              <p key={i} className="font-body text-lg leading-relaxed" style={{ color: "#1C3A2E" }}>
                {para}
              </p>
            ))}
          </div>

          <div className="mb-16">
            <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>
              Your Top 5 Herbs
            </h2>
            <div className="space-y-4">
              {profile.herbs.map((herb, i) => (
                <div
                  key={i}
                  className="p-5 border rounded"
                  style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}
                >
                  <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "#C9A84C" }}>
                    {herb.name}
                  </h3>
                  <p className="font-body text-base" style={{ color: "#1C3A2E" }}>
                    {herb.note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div
            className="text-center p-10 rounded"
            style={{ backgroundColor: "#1C3A2E" }}
          >
            <h3 className="font-serif text-2xl font-bold mb-4" style={{ color: "#C9A84C" }}>
              Ready to Go Deeper?
            </h3>
            <p className="font-body text-lg mb-8 max-w-xl mx-auto" style={{ color: "#F5F0E8" }}>
              The Foundations Course teaches you how to read your constitution and match it to God's provision in the plant world.
            </p>
            <Button
              variant="eden-light"
              size="xl"
              onClick={() => setCourseModal(true)}
            >
              → Join the Waitlist
            </Button>
          </div>
        </div>
      )}

      <WaitlistModal
        open={courseModal}
        onOpenChange={setCourseModal}
        audienceId={COURSE_AUDIENCE_ID}
        title="Join the Foundations Course Waitlist"
      />
    </div>
  );
};

export default Assessment;
