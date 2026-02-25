import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audienceId: string;
  title: string;
}

const WaitlistModal = ({ open, onOpenChange, audienceId, title }: WaitlistModalProps) => {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("resend-waitlist", {
        body: { firstName, email, audienceId, source: "waitlist" },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setSuccess(true);
      setFirstName("");
      setEmail("");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSuccess(false);
      setError("");
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-foreground">{title}</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <p className="font-accent text-lg text-foreground italic">
              You're on the list. We'll be in touch.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div>
              <label className="block font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                required
                className="w-full px-4 py-3 bg-background border border-border font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-eden-gold transition-colors"
              />
            </div>
            <div>
              <label className="block font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 bg-background border border-border font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-eden-gold transition-colors"
              />
            </div>
            {error && (
              <p className="font-body text-sm text-destructive">{error}</p>
            )}
            <Button variant="eden" size="xl" className="w-full" disabled={loading}>
              {loading ? "Submitting…" : "→ Join the Waitlist"}
            </Button>
            <p className="text-center font-body text-xs text-muted-foreground/60">
              No spam. Unsubscribe anytime.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WaitlistModal;
