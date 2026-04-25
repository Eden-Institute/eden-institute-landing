import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { constitutionProfiles, computeResult, isInconclusiveResult, inconclusiveAxes } from "@/lib/constitution-data";

interface Question {
  id: number;
  axis: "temperature" | "fluid" | "tone";
  question: string;
  options: { label: string; text: string; score: string }[];
}

const questions: Question[] = [
  { id: 1, axis: "temperature", question: "How would you describe your body temperature in everyday life?", options: [
    { label: "A", text: "I run warm — I often feel too hot, prefer cool rooms, and kick off blankets at night", score: "Hot" },
    { label: "B", text: "I run cool — I'm often the coldest person in the room and love warming up", score: "Cold" },
    { label: "C", text: "It varies a lot — sometimes hot, sometimes cold, hard to pin down", score: "neutral" },
    { label: "D", text: "I don't notice much either way", score: "neutral" },
  ]},
  { id: 2, axis: "temperature", question: "When you're under stress or overwhelmed, what happens to your body?", options: [
    { label: "A", text: "I get hot, flushed, or feel heat in my chest and face", score: "Hot" },
    { label: "B", text: "I get cold, stiff, or feel chilled and want to bundle up", score: "Cold" },
    { label: "C", text: "I get sweaty but also cold at the same time", score: "neutral" },
    { label: "D", text: "My temperature doesn't change much", score: "neutral" },
  ]},
  { id: 3, axis: "temperature", question: "How do you feel after eating a large, rich, or heavy meal?", options: [
    { label: "A", text: "Uncomfortable, overly warm, or nauseous", score: "Hot" },
    { label: "B", text: "Better — a warm meal genuinely helps me", score: "Cold" },
    { label: "C", text: "Sluggish and sleepy regardless", score: "neutral" },
    { label: "D", text: "Depends on the food", score: "neutral" },
  ]},
  { id: 4, axis: "temperature", question: "What kind of weather feels best to your body?", options: [
    { label: "A", text: "Cool or cold weather", score: "Hot" },
    { label: "B", text: "Warm or hot weather", score: "Cold" },
    { label: "C", text: "Mild seasons", score: "neutral" },
    { label: "D", text: "No strong preference", score: "neutral" },
  ]},
  { id: 5, axis: "fluid", question: "How would you describe your skin and mucous membranes?", options: [
    { label: "A", text: "Oily skin, prone to breakouts, mucus congestion", score: "Damp" },
    { label: "B", text: "Dry skin, dry eyes, dry mouth, tendency toward dehydration", score: "Dry" },
    { label: "C", text: "Combination", score: "neutral" },
    { label: "D", text: "Normal", score: "neutral" },
  ]},
  { id: 6, axis: "fluid", question: "How does your body handle respiratory illness?", options: [
    { label: "A", text: "Lots of mucus, congestion, runny nose, phlegm", score: "Damp" },
    { label: "B", text: "Dry, tight, unproductive symptoms — dry cough", score: "Dry" },
    { label: "C", text: "Varies by illness", score: "neutral" },
    { label: "D", text: "Don't get sick often enough to notice", score: "neutral" },
  ]},
  { id: 7, axis: "fluid", question: "Which best describes your digestion?", options: [
    { label: "A", text: "Loose, sluggish, prone to bloating — I retain water easily", score: "Damp" },
    { label: "B", text: "Dry, constipated, prone to hard stools", score: "Dry" },
    { label: "C", text: "Irregular — alternates", score: "neutral" },
    { label: "D", text: "Generally normal", score: "neutral" },
  ]},
  { id: 8, axis: "fluid", question: "How would you describe your body's build?", options: [
    { label: "A", text: "I gain weight easily, retain fluid, soft or puffy tissue", score: "Damp" },
    { label: "B", text: "I stay lean naturally, dry out easily, firm tissue", score: "Dry" },
    { label: "C", text: "I fluctuate", score: "neutral" },
    { label: "D", text: "Don't strongly identify with either", score: "neutral" },
  ]},
  { id: 9, axis: "tone", question: "How does your nervous system respond to stress?", options: [
    { label: "A", text: "I tighten up — shoulders, jaw, gut clench and it's hard to let go", score: "Tense" },
    { label: "B", text: "I go soft or spacey — scattered, loose, lose focus", score: "Relaxed" },
    { label: "C", text: "I swing between the two", score: "neutral" },
    { label: "D", text: "I stay pretty even", score: "neutral" },
  ]},
  { id: 10, axis: "tone", question: "Where do you feel tension most often?", options: [
    { label: "A", text: "Tight muscles, clenched jaw, tension headaches, cramping", score: "Tense" },
    { label: "B", text: "Weakness, sagging feeling, poor muscle tone, heaviness", score: "Relaxed" },
    { label: "C", text: "Pain that moves — sometimes tight, sometimes loose", score: "neutral" },
    { label: "D", text: "No consistent pattern", score: "neutral" },
  ]},
  { id: 11, axis: "tone", question: "How would you describe your sleep?", options: [
    { label: "A", text: "Hard to fall asleep — mind won't stop, body feels wound up", score: "Tense" },
    { label: "B", text: "Fall asleep easily but sleep too deeply — hard to feel rested", score: "Relaxed" },
    { label: "C", text: "Inconsistent", score: "neutral" },
    { label: "D", text: "Sleep normally", score: "neutral" },
  ]},
  { id: 12, axis: "tone", question: "How do your emotions express in your body?", options: [
    { label: "A", text: "Intense — I feel things strongly, shows up as tension, heat, or pain", score: "Tense" },
    { label: "B", text: "Porous — I absorb others' energy and feel drained or loose", score: "Relaxed" },
    { label: "C", text: "I bottle things up until I crash", score: "neutral" },
    { label: "D", text: "I process emotions smoothly", score: "neutral" },
  ]},
];

const Assessment = () => {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [phase, setPhase] = useState<"quiz" | "gate" | "inconclusive" | "results">("quiz");
  const [transitioning, setTransitioning] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const constitutionType = phase !== "quiz" ? computeResult(answers) : "";
  const isInconclusive = constitutionType ? isInconclusiveResult(constitutionType) : false;
  const neutralAxes = constitutionType && isInconclusive ? inconclusiveAxes(constitutionType) : [];
  const profile = constitutionType ? constitutionProfiles[constitutionType] : null;

  const handleAnswer = useCallback((questionId: number, score: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: score };
      // On the final question, route based on result. Inconclusive results
      // never enter the email-capture gate per Locked Decision §0.8 #39.
      setTransitioning(true);
      setTimeout(() => {
        if (currentQ < questions.length - 1) {
          setCurrentQ((p) => p + 1);
        } else {
          const result = computeResult(next);
          setPhase(isInconclusiveResult(result) ? "inconclusive" : "gate");
        }
        setTransitioning(false);
      }, 400);
      return next;
    });
  }, [currentQ]);

  const restartQuiz = useCallback(() => {
    setAnswers({});
    setCurrentQ(0);
    setPhase("quiz");
    setError("");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("resend-waitlist", {
        body: {
          firstName,
          email,
          constitutionType,
          constitutionNickname: profile?.nickname,
          source: "constitution_assessment",
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Constitution capture for /apothecary personalization (independent of
      // marketing-consent). Failure here must NOT block the result reveal —
      // personalization is recoverable (the user can retake the quiz post-
      // signup) but a blocked results page is not. We log to Edge Function
      // logs for ops visibility instead of surfacing to the user.
      try {
        const { data: recordData, error: recordError } =
          await supabase.functions.invoke("record-quiz-completion", {
            body: {
              email,
              first_name: firstName,
              constitution_type: constitutionType,
              constitution_nickname: profile?.nickname,
            },
          });
        if (recordError) {
          console.error("record-quiz-completion failed", recordError);
        } else if (recordData?.error) {
          console.error("record-quiz-completion returned error", recordData.error);
        }
      } catch (recordErr) {
        console.error("record-quiz-completion threw", recordErr);
      }

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
            Body Pattern Quiz
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
          <div className={`transition-all duration-400 ${transitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}>
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
            Your Body Pattern
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-bold mt-4 mb-2" style={{ color: "#1C3A2E" }}>
            {profile.nickname}
          </h2>
          <p className="font-body text-base mb-1" style={{ color: "#1C3A2E" }}>
            {constitutionType}
          </p>
          <p className="font-accent text-lg italic mb-8" style={{ color: "#C9A84C" }}>
            {profile.tagline}
          </p>

          <div className="p-8 border rounded" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
            <h3 className="font-serif text-xl font-bold mb-2" style={{ color: "#1C3A2E" }}>
              Get Your Full Body Pattern Profile
            </h3>
            <p className="font-body text-sm mb-6" style={{ color: "hsl(30, 10%, 40%)" }}>
              Enter your name and email to receive your full body pattern profile and personalized herb recommendations.
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
              <Button type="submit" variant="eden" size="xl" className="w-full" disabled={loading}>
                {loading ? "Submitting…" : "→ Send Me My Results"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {phase === "inconclusive" && (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>
            Pattern Inconclusive
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-bold mt-4 mb-6" style={{ color: "#1C3A2E" }}>
            Your responses didn't resolve to a clear Pattern.
          </h2>

          <div className="space-y-5 mb-10 text-left">
            <p className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>
              {neutralAxes.length === 1 ? (
                <>This usually happens when "varies" or "no preference" answers cluster on the <strong>{neutralAxes[0]}</strong> axis. Your body may genuinely be balanced on that axis, or the quiz may benefit from a more deliberate retake.</>
              ) : (
                <>This usually happens when "varies" or "no preference" answers cluster across multiple axes (here: <strong>{neutralAxes.join(", ")}</strong>). Your body may genuinely be balanced on one or more of these axes, or the quiz may benefit from a more deliberate retake.</>
              )}
            </p>
            <p className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>
              We never default you to a Pattern when your responses don't clearly indicate one. The honest answer is: take a closer look at the questions and pick A or B whenever you can — the resolution improves quickly.
            </p>
          </div>

          <Button
            type="button"
            variant="eden"
            size="xl"
            className="w-full"
            onClick={restartQuiz}
          >
            → Retake the Quiz with More Deliberate Answers
          </Button>

          <p className="font-body text-xs italic mt-4" style={{ color: "hsl(30, 10%, 40%, 0.7)" }}>
            Some constitutions are genuinely balanced on an axis — this is itself a clinical category, not a quiz failure. The Root-tier deeper diagnostic (40 questions, four classical Western frameworks) is built to resolve cases like this.
          </p>
        </div>
      )}

      {phase === "results" && profile && (
        <div className="max-w-3xl mx-auto px-6 py-16">
          {/* Section A: Type Header */}
          <div className="text-center mb-12">
            <p className="font-body text-sm mb-1" style={{ color: "#C9A84C" }}>
              ✓ Your results are on their way. Check your inbox.
            </p>
            <p className="font-body text-xs italic mb-4" style={{ color: "#C9A84C", opacity: 0.8 }}>
              Using Gmail? Your first email may arrive in your Promotions or Spam folder. Please move it to your Primary inbox so you don't miss anything from us.
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-bold mt-4 mb-2" style={{ color: "#1C3A2E" }}>
              {profile.nickname}
            </h1>
            <p className="font-body text-lg mb-1" style={{ color: "#1C3A2E" }}>
              {constitutionType}
            </p>
            <p className="font-accent text-xl italic" style={{ color: "#C9A84C" }}>
              {profile.tagline}
            </p>
          </div>

          {/* Section B: Pattern Summary */}
          <div className="space-y-6 mb-16">
            {profile.description.map((para, i) => (
              <p key={i} className="font-body text-lg leading-relaxed" style={{ color: "#1C3A2E" }}>
                {para}
              </p>
            ))}
          </div>

          {/* Section C: Top 3 Herbs */}
          <div className="mb-16">
            <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>
              Your Top 3 Herbs
            </h2>
            <div className="space-y-4">
              {profile.herbs.slice(0, 3).map((herb, i) => (
                <div key={i} className="p-5 border rounded" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
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

          {/* Section D: $14 Deep-Dive Guide Upsell */}
          <div className="p-6 md:p-8 border-2 rounded mb-12" style={{ borderColor: "#C9A84C", backgroundColor: "white" }}>
            <h2 className="font-serif text-2xl font-bold mb-4" style={{ color: "#1C3A2E" }}>
              Want the full picture?
            </h2>
            <p className="font-body text-base leading-relaxed mb-4" style={{ color: "#1C3A2E" }}>
              Your complete Deep-Dive Guide includes all 10 matched herbs with clinical preparation methods, dosages, and safety notes — plus caution lists, lifestyle and nutrition guidance, and a Biblical framework for your body pattern.
            </p>
            <Button
              variant="eden"
              size="xl"
              className="w-full"
              data-product="constitution-guide"
              disabled={checkoutLoading}
              onClick={async () => {
                setCheckoutLoading(true);
                try {
                  const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
                    body: {
                      constitution_type: constitutionType,
                      constitution_nickname: profile?.nickname,
                      email,
                    },
                  });
                  if (fnError) throw fnError;
                  if (data?.url) window.location.href = data.url;
                } catch (err: any) {
                  setError(err.message || "Could not start checkout");
                } finally {
                  setCheckoutLoading(false);
                }
              }}
            >
              {checkoutLoading ? "Redirecting to checkout…" : `Get Your Full ${profile.nickname} Guide — $14`}
            </Button>
          </div>

          {/* Section E: Amazon Herb Kit */}
          <div className="p-6 md:p-8 rounded mb-12" style={{ backgroundColor: "#F5F0E8" }}>
            <h2 className="font-serif text-2xl font-bold mb-4" style={{ color: "#1C3A2E" }}>
              Your Starter Herb Kit
            </h2>
            <p className="font-body text-base leading-relaxed mb-6" style={{ color: "#1C3A2E" }}>
              We curated the exact herbs for your body pattern on Amazon. One-click shopping list — everything you need to get started.
            </p>
            <a
              href={profile.amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-8 py-4 font-serif font-bold text-base tracking-wider uppercase transition-colors rounded"
              style={{ backgroundColor: "#1C3A2E", color: "#F5F0E8" }}
            >
              Shop Your Kit on Amazon
            </a>
            <p className="font-body text-xs text-center mt-3" style={{ color: "hsl(30, 10%, 40%, 0.6)" }}>
              Affiliate link — I earn a small commission at no cost to you.
            </p>
          </div>

          {/* Section F: Course CTA */}
          <div className="text-center p-10 rounded mb-8" style={{ backgroundColor: "#1C3A2E" }}>
            <h3 className="font-serif text-2xl font-bold mb-4" style={{ color: "#C9A84C" }}>
              Ready to Go Deeper?
            </h3>
            <p className="font-body text-lg mb-8 max-w-xl mx-auto" style={{ color: "#F5F0E8" }}>
              The Foundations Course teaches you how to read your body pattern and match it to God's provision in the plant world.
            </p>
            <a
              href="/why-eden"
              className="inline-flex items-center justify-center px-10 py-4 font-serif font-bold text-base tracking-wider uppercase transition-colors rounded"
              style={{ backgroundColor: "#C9A84C", color: "#1C3A2E" }}
            >
              Learn About the Foundations Course
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assessment;
