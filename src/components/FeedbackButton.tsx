// FeedbackButton — floating in-app feedback affordance.
//
// Workstream B (Feature_Request_Intake_Spec.md): progressive narrowing
// intake — type → area → sub-area → specifics — rather than one big box.
// Structured capture at submission time is what makes triage tractable.
// Page URL / user agent / tier are captured automatically (tier resolves
// server-side in the EF); authed users see a "my submissions" status list
// (received → planned → shipped loop-closure).
//
// Mounted at App.tsx root inside AuthProvider so it appears on every route,
// marketing + apothecary alike. Source of truth: public.feedback_submissions
// (Lock #15). EF: submit-feedback. Mirrors to hello@edeninstitute.health.
//
// Lock #45: informational ingestion surface only — no clinical content here.
// Lock #47: reinforces app-character of Eden Apothecary.

import { useState, useEffect } from "react";
import { MessageSquare, Send, Loader2, ArrowLeft, Bug, Lightbulb, Wrench, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`;

type FeedbackType = "bug" | "feature" | "improvement" | "question";

const TYPE_OPTIONS: { key: FeedbackType; label: string; hint: string; icon: typeof Bug }[] = [
  { key: "bug", label: "Something's broken", hint: "An error, a wrong result, a page that misbehaves", icon: Bug },
  { key: "feature", label: "Feature idea", hint: "Something new you wish the app could do", icon: Lightbulb },
  { key: "improvement", label: "Improvement", hint: "Something that works but could work better", icon: Wrench },
  { key: "question", label: "Question", hint: "Something unclear you'd like explained", icon: HelpCircle },
];

interface Area {
  area_key: string;
  label: string;
  sub_areas: string[];
}

interface MySubmission {
  id: string;
  title: string | null;
  message: string;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Received",
  triaged: "Reviewed",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Declined",
  duplicate: "Merged with a similar report",
};

export function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<FeedbackType | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [area, setArea] = useState<Area | null>(null);
  const [subArea, setSubArea] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState<MySubmission[] | null>(null);
  const [showMine, setShowMine] = useState(false);

  // Pre-fill email when modal opens for a signed-in user.
  useEffect(() => {
    if (open && user?.email && !email) {
      setEmail(user.email);
    }
  }, [open, user?.email, email]);

  // Area taxonomy loads once per open (reference table, anon-readable).
  useEffect(() => {
    if (!open || areas.length) return;
    supabase
      .from("feedback_areas" as never)
      .select("area_key,label,sub_areas")
      .order("sort_order" as never)
      .then(({ data }) => {
        if (data) setAreas(data as unknown as Area[]);
      });
  }, [open, areas.length]);

  // "My submissions" — loop closure for authed users (own-rows RLS).
  useEffect(() => {
    if (!open || !user || mine !== null) return;
    supabase
      .from("feedback_submissions" as never)
      .select("id,title,message,status,created_at")
      .order("created_at" as never, { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setMine(data as unknown as MySubmission[]);
      });
  }, [open, user, mine]);

  function reset() {
    setStep(1);
    setType(null);
    setArea(null);
    setSubArea("");
    setTitle("");
    setDescription("");
    setImpact("");
    setFrequency("");
    setShowMine(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Please describe the specifics first.");
      return;
    }
    setSubmitting(true);
    try {
      // Best-effort: include auth bearer if signed in so the EF can bind
      // auth_user_id + tier. Anonymous submissions are fine too.
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(SUPABASE_FN_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type,
          area: area?.area_key ?? null,
          subArea: subArea || null,
          title: title.trim() || null,
          description: description.trim(),
          impact: impact || null,
          frequency: type === "bug" ? frequency || null : null,
          email: email.trim() || null,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          context: { source: "floating-widget-v2" },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Could not send feedback. Please try again.");
        return;
      }
      toast.success("Thank you — your feedback was received.");
      reset();
      setMine(null); // refresh next open
      setOpen(false);
    } catch (err) {
      console.error("FeedbackButton submit error:", err);
      toast.error("Could not send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isBug = type === "bug";

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Send feedback to Eden Apothecary"
          className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-[#2C3E2D] px-4 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-[#1f2c20] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A44E] focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
          style={{ minHeight: 44 }}
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Feedback</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#2C3E2D]">
            {step === 1 && "Share your feedback"}
            {step === 2 && "Where does this belong?"}
            {step === 3 && "Tell us the specifics"}
          </DialogTitle>
          <DialogDescription className="text-[#6B6560]">
            {step === 1 && "Every note helps us shape Eden Apothecary. What kind of note is this?"}
            {step === 2 && "Pick the part of the app this is about."}
            {step === 3 && (isBug ? "What did you expect, and what happened instead?" : "The more specific, the faster we can act on it.")}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-2 pt-2">
            {TYPE_OPTIONS.map(({ key, label, hint, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setType(key); setStep(2); }}
                className="w-full rounded-md border border-[#E8E3DA] px-4 py-3 text-left transition-colors hover:border-[#C5A44E] hover:bg-[#F5F0E8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A44E]"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-[#2C3E2D]" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium text-[#3D3832]">{label}</span>
                    <span className="block text-xs text-[#6B6560]">{hint}</span>
                  </span>
                </span>
              </button>
            ))}
            {user && mine && mine.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowMine((v) => !v)}
                  className="text-xs font-medium text-[#2C3E2D] underline underline-offset-2"
                >
                  {showMine ? "Hide my submissions" : `My submissions (${mine.length})`}
                </button>
                {showMine && (
                  <ul className="mt-2 space-y-1">
                    {mine.map((m) => (
                      <li key={m.id} className="flex items-start justify-between gap-2 rounded border border-[#E8E3DA] px-3 py-2">
                        <span className="text-xs text-[#3D3832] line-clamp-1">{m.title || m.message}</span>
                        <span className="shrink-0 rounded-full bg-[#F5F0E8] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2C3E2D]">
                          {STATUS_LABELS[m.status] ?? m.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2 pt-2">
            {areas.map((a) => (
              <button
                key={a.area_key}
                type="button"
                onClick={() => { setArea(a); setSubArea(""); setStep(3); }}
                className="w-full rounded-md border border-[#E8E3DA] px-4 py-2.5 text-left text-sm text-[#3D3832] transition-colors hover:border-[#C5A44E] hover:bg-[#F5F0E8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A44E]"
              >
                {a.label}
              </button>
            ))}
            <div className="pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {area && area.sub_areas.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="feedback-subarea" className="text-[#3D3832]">
                  Narrow it down <span className="font-normal text-[#6B6560]">(optional)</span>
                </Label>
                <select
                  id="feedback-subarea"
                  value={subArea}
                  onChange={(e) => setSubArea(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— {area.label} in general —</option>
                  {area.sub_areas.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="feedback-title" className="text-[#3D3832]">Short summary</Label>
              <Input
                id="feedback-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isBug ? "e.g. Herb search shows no results for 'nettle'" : "One line that captures it"}
                maxLength={140}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-description" className="text-[#3D3832]">The specifics</Label>
              <Textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isBug
                  ? "What I expected: …\nWhat happened instead: …"
                  : "Tell us what you have in mind…"}
                rows={4}
                maxLength={5000}
                required
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="feedback-impact" className="text-[#3D3832]">How much does it matter?</Label>
                <select
                  id="feedback-impact"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Not sure</option>
                  <option value="blocking">It blocks me</option>
                  <option value="major">Major annoyance</option>
                  <option value="minor">Minor annoyance</option>
                  <option value="nice_to_have">Nice to have</option>
                </select>
              </div>
              {isBug && (
                <div className="space-y-2">
                  <Label htmlFor="feedback-frequency" className="text-[#3D3832]">How often?</Label>
                  <select
                    id="feedback-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Not sure</option>
                    <option value="always">Every time</option>
                    <option value="often">Often</option>
                    <option value="sometimes">Sometimes</option>
                    <option value="once">Just once</option>
                  </select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-email" className="text-[#3D3832]">
                Email <span className="font-normal text-[#6B6560]">(optional, so we can follow up)</span>
              </Label>
              <Input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={255}
                autoComplete="email"
              />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={submitting}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                type="submit"
                disabled={submitting || !description.trim()}
                className="bg-[#2C3E2D] text-white hover:bg-[#1f2c20]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send feedback
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
