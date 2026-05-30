import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  axisDisplayLabel,
  constitutionProfiles,
  computeResult,
  computeResultWithFollowups,
  isInconclusiveResult,
  inconclusiveAxes,
} from "@/lib/constitution-data";
import {
  getFollowupQuestionsForAxes,
  type FollowupQuestion,
} from "@/lib/quiz-followup";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProfileOptional } from "@/contexts/ActiveProfileContext";
import { useQueryClient } from "@tanstack/react-query";
import { ROUTES } from "@/lib/routes";
import Navbar from "@/components/landing/Navbar";

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

function computeAxisPositions(answers: Record<number, string>) {
  let hot = 0, cold = 0, damp = 0, dry = 0, tense = 0, relaxed = 0;
  for (const q of questions) {
    const a = answers[q.id];
    if (a === "Hot") hot++;
    else if (a === "Cold") cold++;
    else if (a === "Damp") damp++;
    else if (a === "Dry") dry++;
    else if (a === "Tense") tense++;
    else if (a === "Relaxed") relaxed++;
  }
  return {
    temperature: (hot - cold) / 4,
    fluid: (damp - dry) / 4,
    tone: (tense - relaxed) / 4,
  };
}

interface AxisSpectrumProps {
  axisLabel: string;
  leftLabel: string;
  rightLabel: string;
  position: number;
  isInconclusive: boolean;
}

function AxisSpectrum({ axisLabel, leftLabel, rightLabel, position, isInconclusive }: AxisSpectrumProps) {
  const leftPct = 50 + position * 40;
  const markerColor = isInconclusive ? "#C9A84C" : "#1C3A2E";
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-accent text-xs tracking-[0.15em] uppercase" style={{ color: "#1C3A2E" }}>{leftLabel}</span>
        <span className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: isInconclusive ? "#C9A84C" : "hsl(30, 10%, 40%)" }}>
          {axisLabel}{isInconclusive ? " — balanced" : ""}
        </span>
        <span className="font-accent text-xs tracking-[0.15em] uppercase" style={{ color: "#1C3A2E" }}>{rightLabel}</span>
      </div>
      <div className="relative h-3 rounded-full" style={{ backgroundColor: "hsl(40, 20%, 80%)" }}>
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-px h-3" style={{ backgroundColor: "hsl(30, 10%, 40%)", opacity: 0.3 }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full transition-all"
          style={{ left: `${leftPct}%`, backgroundColor: markerColor, border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
        />
      </div>
    </div>
  );
}

const Assessment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const profileCtx = useActiveProfileOptional();

  const profileIdParam = searchParams.get("profileId");
  const targetProfile = useMemo(() => {
    if (!profileIdParam) return null;
    if (!profileCtx) return null;
    return profileCtx.profiles.find((p) => p.id === profileIdParam) ?? null;
  }, [profileIdParam, profileCtx]);
  const diagnosticMode = profileIdParam !== null && targetProfile !== null;
  const profileLookupPending =
    profileIdParam !== null && (profileCtx?.isLoading ?? false);

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // v4.3.1 (PR #109) — added "profile-resolution-error" for the
  // defensive-guard branch in routePostResolution: if profileIdParam is in
  // URL but diagnosticMode didn't engage (ActiveProfileContext missing or
  // targetProfile didn't resolve), surface an error instead of silently
  // falling through to marketing-mode auto-submit (which would write to
  // user.email and silently corrupt sub-profile data).
  const [phase, setPhase] = useState<
    | "quiz"
    | "followup"
    | "gate"
    | "inconclusive"
    | "results"
    | "diagnostic-saving"
    | "diagnostic-saved"
    | "auto-submitting"
    | "balanced-thanks"
    | "profile-resolution-error"
  >("quiz");
  const [followupQueue, setFollowupQueue] = useState<FollowupQuestion[]>([]);
  const [followupIdx, setFollowupIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const constitutionType = phase !== "quiz" && phase !== "followup" ? computeResultWithFollowups(answers) : "";
  const isInconclusive = constitutionType ? isInconclusiveResult(constitutionType) : false;
  const neutralAxes = constitutionType && isInconclusive ? inconclusiveAxes(constitutionType) : [];
  const profile = constitutionType ? constitutionProfiles[constitutionType] : null;
  const axisPositions = useMemo(() => computeAxisPositions(answers), [answers]);

  useEffect(() => {
    if (!user || diagnosticMode) return;
    if (user.email && !email) {
      setEmail(user.email);
    }
    const metaFirstName = (user.user_metadata as Record<string, unknown> | undefined)?.first_name;
    if (typeof metaFirstName === "string" && metaFirstName.trim() && !firstName) {
      setFirstName(metaFirstName.trim());
    }
  }, [user, diagnosticMode, email, firstName]);

  const submitDiagnostic = useCallback(async (answersToSubmit: Record<number, string>) => {
    if (!targetProfile || !user) {
      setError("Missing profile context. Please reload and try again.");
      return;
    }
    setPhase("diagnostic-saving");
    setError("");
    try {
      const result = computeResultWithFollowups(answersToSubmit);
      if (isInconclusiveResult(result)) {
        setPhase("inconclusive");
        return;
      }
      const { data, error: fnError } = await supabase.functions.invoke(
        "record-diagnostic-completion",
        {
          body: {
            personProfileId: targetProfile.id,
            edenConstitution: result,
            quizVersion: "v1-diagnostic",
          },
        },
      );
      if (fnError) throw fnError;
      if (data?.error) {
        const msg = typeof data.error === "string"
          ? data.error
          : (data.error.message ?? "Could not save your Pattern. Please try again.");
        throw new Error(msg);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["person_profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["eden_pattern_v2"] }),
        queryClient.invalidateQueries({ queryKey: ["diagnostic_profile_v2"] }),
      ]);

      setPhase("diagnostic-saved");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not save your Pattern. Please try again.";
      setError(message);
      setPhase("gate");
    }
  }, [targetProfile, user, queryClient]);

  useEffect(() => {
    if (phase === "diagnostic-saved") {
      const t = setTimeout(() => {
        navigate(ROUTES.APOTHECARY_START, { replace: true });
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [phase, navigate]);

  const submitMarketingQuiz = useCallback(async (
    submittedEmail: string,
    submittedFirstName: string,
    submittedConstitution: string,
    balanced = false,
  ) => {
    if (!submittedEmail || !submittedConstitution) {
      setError("Missing email or quiz result. Please try again.");
      return;
    }
    setError("");
    try {
      // Lock #56 — Genuinely Balanced terrain has no named Pattern, so it can't
      // run the resolved-Pattern nurture (no matching content) and has no
      // /results/{slug}. Capture the email to the master audience so the person
      // is never lost (no constitutionType → resend-waitlist adds the contact
      // and skips the Pattern drip), then show the balanced closure. Surfacing
      // balanced leads on the dashboard + a tailored deeper-diagnostic email is
      // a follow-up (needs an Edge Function + entry_funnel enum change).
      if (balanced) {
        const { data, error: fnError } = await supabase.functions.invoke("resend-waitlist", {
          body: {
            firstName: submittedFirstName,
            email: submittedEmail,
            source: "constitution_assessment",
          },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        setPhase("balanced-thanks");
        return;
      }

      const profileForSubmit = constitutionProfiles[submittedConstitution];
      const { data, error: fnError } = await supabase.functions.invoke("resend-waitlist", {
        body: {
          firstName: submittedFirstName,
          email: submittedEmail,
          constitutionType: submittedConstitution,
          constitutionNickname: profileForSubmit?.nickname,
          source: "constitution_assessment",
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      try {
        const { data: recordData, error: recordError } =
          await supabase.functions.invoke("record-quiz-completion", {
            body: {
              email: submittedEmail,
              first_name: submittedFirstName,
              constitution_type: submittedConstitution,
              constitution_nickname: profileForSubmit?.nickname,
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

      const slugForRedirect = (profileForSubmit?.nickname ?? "")
        .replace(/^The\s+/i, "")
        .toLowerCase()
        .replace(/\s+/g, "-");
      navigate(ROUTES.RESULTS(slugForRedirect), { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      // Return to the surface that carries a form so the user can retry without
      // a blank screen: gate for resolved Patterns, inconclusive for balanced.
      setPhase(balanced ? "inconclusive" : "gate");
    }
  }, [navigate]);

  // v4.3.1 (PR #109) — routePostResolution adds a defensive guard branch
  // BEFORE the diagnosticMode check. If profileIdParam is in URL but
  // diagnosticMode didn't engage (ActiveProfileContext missing or
  // targetProfile didn't resolve), surface an error instead of silently
  // falling through to marketing-mode auto-submit. The marketing-mode
  // pipeline writes to user.email — NEVER a sub-profile — so falling
  // through corrupts data while looking like success.
  const routePostResolution = useCallback(
    (currentAnswers: Record<number, string>, fromFollowup: boolean) => {
      const result = fromFollowup
        ? computeResultWithFollowups(currentAnswers)
        : computeResult(currentAnswers);
      const balanced = isInconclusiveResult(result);

      // GUARD (PR #109): profileId requested but diagnosticMode didn't engage.
      // Do not silently fall to marketing mode (which writes to user.email).
      // Applies to balanced results too — checked before any capture.
      if (profileIdParam !== null && !diagnosticMode) {
        setError(
          "The selected profile didn't load on this page. Please go back to the apothecary, " +
          "confirm the profile picker shows the right person, and click the quiz button again."
        );
        setPhase("profile-resolution-error");
        return;
      }

      // In-app diagnostic: submitDiagnostic handles balanced internally
      // (renders the inconclusive surface, no marketing capture/form).
      if (diagnosticMode) {
        submitDiagnostic(currentAnswers);
        return;
      }

      // Marketing quiz — Lock #56: every terminal state passes through capture,
      // including Genuinely Balanced.
      if (user?.email && !authLoading) {
        setPhase("auto-submitting");
        const submitEmail = user.email;
        const metaFirstName = (user.user_metadata as Record<string, unknown> | undefined)?.first_name;
        const submitFirstName =
          typeof metaFirstName === "string" && metaFirstName.trim()
            ? metaFirstName.trim()
            : firstName;
        void submitMarketingQuiz(submitEmail, submitFirstName, result, balanced);
      } else {
        // Anon: resolved → gate form; balanced → inconclusive surface, which
        // now carries its own capture form.
        setPhase(balanced ? "inconclusive" : "gate");
      }
    },
    [profileIdParam, diagnosticMode, submitDiagnostic, user, authLoading, firstName, submitMarketingQuiz],
  );

  const handleAnswer = useCallback((questionId: number, score: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: score };
      setTransitioning(true);
      setTimeout(() => {
        if (currentQ < questions.length - 1) {
          setCurrentQ((p) => Math.min(p + 1, questions.length - 1));
        } else {
          const result = computeResult(next);
          if (isInconclusiveResult(result)) {
            const tiedAxes = inconclusiveAxes(result);
            const queue = getFollowupQuestionsForAxes(tiedAxes);
            setFollowupQueue(queue);
            setFollowupIdx(0);
            setPhase("followup");
          } else {
            routePostResolution(next, false);
          }
        }
        setTransitioning(false);
      }, 400);
      return next;
    });
  }, [currentQ, routePostResolution]);

  const handleFollowupAnswer = useCallback((questionId: number, score: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: score };
      setTransitioning(true);
      setTimeout(() => {
        const queueLen = followupQueue.length;
        const nextIdx = followupIdx + 1;
        if (nextIdx < queueLen) {
          setFollowupIdx(nextIdx);
        } else {
          routePostResolution(next, true);
        }
        setTransitioning(false);
      }, 400);
      return next;
    });
  }, [followupQueue, followupIdx, routePostResolution]);

  const restartQuiz = useCallback(() => {
    setAnswers({});
    setCurrentQ(0);
    setFollowupQueue([]);
    setFollowupIdx(0);
    setPhase("quiz");
    setError("");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submitMarketingQuiz(email, firstName, constitutionType);
    } finally {
      setLoading(false);
    }
  };

  const handleBalancedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submitMarketingQuiz(email, firstName, constitutionType, true);
    } finally {
      setLoading(false);
    }
  };

  const q = questions[currentQ];
  const progress = phase === "quiz" && q ? ((currentQ + (answers[q.id] ? 1 : 0)) / questions.length) * 100 : 100;
  const axisLabel = q?.axis === "temperature" ? "Temperature Axis" : q?.axis === "fluid" ? "Fluid Axis" : "Tone Axis";

  const currentFollowup: FollowupQuestion | undefined = phase === "followup" ? followupQueue[followupIdx] : undefined;
  const followupProgress =
    phase === "followup" && followupQueue.length > 0
      ? ((followupIdx + (currentFollowup && answers[currentFollowup.id] ? 1 : 0)) / followupQueue.length) * 100
      : 0;

  if (profileLookupPending) {
    return (
      <div className={diagnosticMode ? "" : "min-h-screen"} style={!diagnosticMode ? { backgroundColor: "#F5F0E8" } : undefined}>
        <div className="max-w-xl mx-auto px-6 py-16 text-center font-body" style={{ color: "#1C3A2E" }}>
          Loading profile…
        </div>
      </div>
    );
  }

  if (profileIdParam !== null && !targetProfile && profileCtx !== null) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <h2 className="font-serif text-2xl font-bold mb-3" style={{ color: "#1C3A2E" }}>
          Profile not found
        </h2>
        <p className="font-body text-base mb-6" style={{ color: "#1C3A2E" }}>
          The profile you tried to take the quiz for doesn't belong to your account or no longer exists.
        </p>
        <Button variant="eden" size="lg" onClick={() => navigate(ROUTES.APOTHECARY_PROFILES)}>
          Manage profiles
        </Button>
      </div>
    );
  }

  return (
    <div className={diagnosticMode ? "" : "min-h-screen"} style={!diagnosticMode ? { backgroundColor: "#F5F0E8" } : undefined}>
      {!diagnosticMode && <Navbar />}

      {diagnosticMode && targetProfile && phase === "quiz" && (
        <div className="max-w-2xl mx-auto px-6 pt-8">
          <p className="font-accent text-xs tracking-[0.2em] uppercase mb-1" style={{ color: "#C9A84C" }}>
            Pattern of Eden Quiz
          </p>
          <h1 className="font-serif text-2xl md:text-3xl font-bold" style={{ color: "#1C3A2E" }}>
            {targetProfile.is_self ? "For you" : `For ${targetProfile.name}`}
          </h1>
        </div>
      )}

      {phase === "quiz" && q && (
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <span className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "#C9A84C" }}>{axisLabel}</span>
              <span className="font-body text-sm" style={{ color: "#1C3A2E" }}>Question {currentQ + 1} of {questions.length}</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: "hsl(40, 20%, 80%)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: "#C9A84C" }} />
            </div>
          </div>
          <div className={`transition-all duration-400 ${transitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8" style={{ color: "#1C3A2E" }}>{q.question}</h2>
            <div className="space-y-4">
              {q.options.map((opt) => (
                <button key={opt.label} onClick={() => handleAnswer(q.id, opt.score)} className="w-full text-left p-5 border-2 rounded transition-all duration-200 hover:border-[#C9A84C] hover:shadow-md group min-h-[44px]" style={{ borderColor: answers[q.id] === opt.score ? "#C9A84C" : "hsl(40, 20%, 80%)", backgroundColor: answers[q.id] === opt.score ? "hsl(40, 55%, 50%, 0.08)" : "white" }}>
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-serif font-bold text-sm border-2 group-hover:border-[#C9A84C] group-hover:text-[#C9A84C] transition-colors" style={{ borderColor: answers[q.id] === opt.score ? "#C9A84C" : "#1C3A2E", color: answers[q.id] === opt.score ? "#C9A84C" : "#1C3A2E" }}>{opt.label}</span>
                    <span className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>{opt.text}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "followup" && currentFollowup && (
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="mb-8 text-center">
            <p className="font-accent text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "#C9A84C" }}>Targeted Follow-Up</p>
            <p className="font-body text-sm" style={{ color: "#1C3A2E" }}>A few sharper questions to resolve your {axisDisplayLabel(currentFollowup.axis)} axis.</p>
          </div>
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <span className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "#C9A84C" }}>{axisDisplayLabel(currentFollowup.axis)} Axis</span>
              <span className="font-body text-sm" style={{ color: "#1C3A2E" }}>Follow-up {followupIdx + 1} of {followupQueue.length}</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: "hsl(40, 20%, 80%)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${followupProgress}%`, backgroundColor: "#C9A84C" }} />
            </div>
          </div>
          <div className={`transition-all duration-400 ${transitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8" style={{ color: "#1C3A2E" }}>{currentFollowup.question}</h2>
            <div className="space-y-4">
              {currentFollowup.options.map((opt) => (
                <button key={opt.label} onClick={() => handleFollowupAnswer(currentFollowup.id, opt.score)} className="w-full text-left p-5 border-2 rounded transition-all duration-200 hover:border-[#C9A84C] hover:shadow-md group min-h-[44px]" style={{ borderColor: answers[currentFollowup.id] === opt.score ? "#C9A84C" : "hsl(40, 20%, 80%)", backgroundColor: answers[currentFollowup.id] === opt.score ? "hsl(40, 55%, 50%, 0.08)" : "white" }}>
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-serif font-bold text-sm border-2 group-hover:border-[#C9A84C] group-hover:text-[#C9A84C] transition-colors" style={{ borderColor: answers[currentFollowup.id] === opt.score ? "#C9A84C" : "#1C3A2E", color: answers[currentFollowup.id] === opt.score ? "#C9A84C" : "#1C3A2E" }}>{opt.label}</span>
                    <span className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>{opt.text}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "auto-submitting" && (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <p className="font-accent text-sm tracking-[0.3em] uppercase mb-3" style={{ color: "#C9A84C" }}>Recording your Pattern</p>
          <p className="font-body text-base" style={{ color: "#1C3A2E" }}>One moment — saving your results to your account…</p>
        </div>
      )}

      {phase === "diagnostic-saving" && (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <p className="font-body text-base" style={{ color: "#1C3A2E" }}>Recording your Pattern…</p>
        </div>
      )}
      {phase === "diagnostic-saved" && profile && targetProfile && (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>Pattern Recorded</span>
          <h2 className="font-serif text-3xl md:text-4xl font-bold mt-4 mb-2" style={{ color: "#1C3A2E" }}>{profile.nickname}</h2>
          <p className="font-body text-base mb-1" style={{ color: "#1C3A2E" }}>{constitutionType}</p>
          <p className="font-accent text-lg italic mb-8" style={{ color: "#C9A84C" }}>{profile.tagline}</p>
          <p className="font-body text-base" style={{ color: "#1C3A2E" }}>Saved to {targetProfile.is_self ? "your profile" : targetProfile.name + "'s profile"}. Returning to the directory…</p>
        </div>
      )}

      {/* v4.3.1 (PR #109) — profile-resolution-error: defensive-guard surface
          when profileIdParam is in URL but diagnosticMode didn't engage. */}
      {phase === "profile-resolution-error" && (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>Profile didn't load</span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold mt-4 mb-4" style={{ color: "#1C3A2E" }}>The selected profile didn't load on this page.</h2>
          <p className="font-body text-base mb-2" style={{ color: "#1C3A2E" }}>{error || "Please go back to the apothecary, confirm the profile picker shows the right person, and click the quiz button again."}</p>
          <p className="font-body text-sm italic mb-8" style={{ color: "hsl(30, 10%, 40%)" }}>Your answers were not saved. Nothing was written to any account.</p>
          <Button variant="eden" size="lg" onClick={() => navigate(ROUTES.APOTHECARY)}>Back to apothecary</Button>
        </div>
      )}

      {phase === "gate" && profile && !diagnosticMode && (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>Your Body Pattern</span>
          <h2 className="font-serif text-3xl md:text-4xl font-bold mt-4 mb-2" style={{ color: "#1C3A2E" }}>{profile.nickname}</h2>
          <p className="font-body text-base mb-1" style={{ color: "#1C3A2E" }}>{constitutionType}</p>
          <p className="font-accent text-lg italic mb-8" style={{ color: "#C9A84C" }}>{profile.tagline}</p>
          <div className="p-8 border rounded" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
            <h3 className="font-serif text-xl font-bold mb-2" style={{ color: "#1C3A2E" }}>Get Your Full Body Pattern Profile</h3>
            <p className="font-body text-sm mb-6" style={{ color: "hsl(30, 10%, 40%)" }}>Enter your name and email to receive your full body pattern profile and personalized herb recommendations.</p>
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(30, 10%, 40%)" }}>First Name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Your first name" className="w-full px-4 py-3 border font-body focus:outline-none transition-colors" style={{ borderColor: "hsl(40, 20%, 80%)", color: "#1C3A2E", backgroundColor: "#F5F0E8" }} />
              </div>
              <div>
                <label className="block font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(30, 10%, 40%)" }}>Email Address</label>
                {/* PR κ: strip ALL whitespace (incl. internal spaces some
                    mobile autocomplete engines insert between '@' and the
                    domain) and lowercase before HTML5 type=email validation. */}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value.replace(/\s+/g, "").toLowerCase().trim())} required placeholder="your@email.com" className="w-full px-4 py-3 border font-body focus:outline-none transition-colors" style={{ borderColor: "hsl(40, 20%, 80%)", color: "#1C3A2E", backgroundColor: "#F5F0E8" }} />
              </div>
              {error && <p className="font-body text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="eden" size="xl" className="w-full" disabled={loading}>{loading ? "Submitting…" : "→ Send Me My Results"}</Button>
            </form>
          </div>
        </div>
      )}

      {phase === "inconclusive" && (
        <div className="max-w-xl mx-auto px-6 py-16">
          <div className="text-center">
            <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>Genuinely Balanced Terrain</span>
            <h2 className="font-serif text-3xl md:text-4xl font-bold mt-4 mb-6" style={{ color: "#1C3A2E" }}>Your terrain doesn't lean to one side on {neutralAxes.length === 1 ? "this axis" : "these axes"}.</h2>
          </div>
          <div className="my-10 p-6 rounded" style={{ backgroundColor: "white", border: "1px solid hsl(40, 20%, 80%)" }}>
            <p className="font-accent text-xs tracking-[0.2em] uppercase mb-5 text-center" style={{ color: "hsl(30, 10%, 40%)" }}>Where you landed on each axis</p>
            <AxisSpectrum axisLabel="Temperature" leftLabel="Hot" rightLabel="Cold" position={axisPositions.temperature} isInconclusive={neutralAxes.includes("temperature")} />
            <AxisSpectrum axisLabel="Fluid" leftLabel="Damp" rightLabel="Dry" position={axisPositions.fluid} isInconclusive={neutralAxes.includes("fluid")} />
            <AxisSpectrum axisLabel="Tone" leftLabel="Tense" rightLabel="Relaxed" position={axisPositions.tone} isInconclusive={neutralAxes.includes("tone")} />
          </div>
          <div className="space-y-5 mb-10 text-left">
            <p className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>You answered the original twelve questions and the targeted follow-ups for the {neutralAxes.length === 1 ? "axis" : "axes"} that didn't resolve. {neutralAxes.length === 1 ? (<>Your <strong>{neutralAxes[0]}</strong> axis still sits balanced — neither side dominant.</>) : (<>Multiple axes still sit balanced (<strong>{neutralAxes.join(", ")}</strong>) — neither side dominant on each.</>)}</p>
            <p className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>This is itself a clinical category — not a quiz failure. Some constitutions are genuinely balanced on an axis, and the deeper diagnostic at the Practitioner tier (40 questions across four classical Western frameworks) is built to resolve cases like yours.</p>
          </div>
          {/* Lock #56 — capture form so a Genuinely Balanced result no longer
              dead-ends without an email. Marketing surface only; the in-app
              diagnostic (diagnosticMode) stays form-free. */}
          {!diagnosticMode && (
            <div className="p-8 border rounded mb-8" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
              <h3 className="font-serif text-xl font-bold mb-2 text-center" style={{ color: "#1C3A2E" }}>Save your reading</h3>
              <p className="font-body text-sm mb-6 text-center" style={{ color: "hsl(30, 10%, 40%)" }}>Enter your name and email — we'll save your balanced reading and let you know when the deeper Practitioner-tier diagnostic opens.</p>
              <form onSubmit={handleBalancedSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(30, 10%, 40%)" }}>First Name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Your first name" className="w-full px-4 py-3 border font-body focus:outline-none transition-colors" style={{ borderColor: "hsl(40, 20%, 80%)", color: "#1C3A2E", backgroundColor: "#F5F0E8" }} />
                </div>
                <div>
                  <label className="block font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(30, 10%, 40%)" }}>Email Address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value.replace(/\s+/g, "").toLowerCase().trim())} required placeholder="your@email.com" className="w-full px-4 py-3 border font-body focus:outline-none transition-colors" style={{ borderColor: "hsl(40, 20%, 80%)", color: "#1C3A2E", backgroundColor: "#F5F0E8" }} />
                </div>
                {error && <p className="font-body text-sm text-destructive">{error}</p>}
                <Button type="submit" variant="eden" size="xl" className="w-full" disabled={loading}>{loading ? "Saving…" : "→ Save My Reading"}</Button>
              </form>
            </div>
          )}
          <p className="font-body text-xs italic mt-4 text-center" style={{ color: "hsl(30, 10%, 40%, 0.7)" }}>If you'd like to retake the quiz from scratch, refresh the page or navigate back to the home page.</p>
        </div>
      )}

      {phase === "balanced-thanks" && (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>Reading Saved</span>
          <h2 className="font-serif text-3xl md:text-4xl font-bold mt-4 mb-6" style={{ color: "#1C3A2E" }}>Thanks — your reading is captured.</h2>
          <p className="font-body text-base leading-relaxed mb-8" style={{ color: "#1C3A2E" }}>Your terrain is genuinely balanced, which is its own clinical category. We've saved your email and will reach out when the deeper Practitioner-tier diagnostic — built to resolve balanced cases like yours — becomes available.</p>
          <Button variant="eden" size="lg" onClick={() => navigate(ROUTES.HOME)}>Back to home</Button>
        </div>
      )}
    </div>
  );
};

export default Assessment;
