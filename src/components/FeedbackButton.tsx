// FeedbackButton — floating in-app feedback affordance.
//
// Mounted at App.tsx root inside AuthProvider so it appears on every route,
// marketing + apothecary alike. Source of truth: public.feedback_submissions
// (Lock #15). EF: submit-feedback. Mirrors to hello@edeninstitute.health.
//
// Lock #45: informational ingestion surface only — no clinical content here.
// Lock #47: reinforces app-character of Eden Apothecary.

import { useState, useEffect } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
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

export function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill email when modal opens for a signed-in user.
  useEffect(() => {
    if (open && user?.email && !email) {
      setEmail(user.email);
    }
  }, [open, user?.email, email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please enter your feedback first.");
      return;
    }
    setSubmitting(true);
    try {
      // Best-effort: include auth bearer if signed in so the EF can bind
      // auth_user_id. Anonymous submissions are fine too.
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(SUPABASE_FN_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: message.trim(),
          email: email.trim() || null,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          context: { source: "floating-widget" },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Could not send feedback. Please try again.");
        return;
      }
      toast.success("Thank you — your feedback was received.");
      setMessage("");
      // Don't clear email — likely the same user will give more feedback.
      setOpen(false);
    } catch (err) {
      console.error("FeedbackButton submit error:", err);
      toast.error("Could not send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#2C3E2D]">Share your feedback</DialogTitle>
          <DialogDescription className="text-[#6B6560]">
            Spotted a bug, broken link, confusing wording, or anything that didn&apos;t feel right?
            Tell us — every note helps us shape Eden Apothecary before launch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="feedback-message" className="text-[#3D3832]">
              What&apos;s on your mind?
            </Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what you noticed…"
              rows={5}
              maxLength={5000}
              required
              autoFocus
              className="resize-none"
            />
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
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !message.trim()}
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
      </DialogContent>
    </Dialog>
  );
}
