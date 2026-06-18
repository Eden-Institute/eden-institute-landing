// PartnerInquiryForm — shared capture-then-book island for the partner /
// collaborator surfaces. Role select -> contact fields -> submit to the
// submit-partner-inquiry EF -> reveal the booking button. Investors get the
// capture-then-approve path (no inline link; Camila reviews and sends it).
//
// client:only — imports the Supabase client (touches localStorage at module
// load), so it must never run during the Astro static build.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { metaTrack } from "@/lib/metaPixel";

type Variant = "home" | "homeschool";

interface Props {
  variant: Variant;
  /** Generic Google booking link revealed to qualified (non-investor) leads. */
  bookingUrl: string;
}

interface RoleOption {
  value: string;
  label: string;
}

const ROLES: Record<Variant, RoleOption[]> = {
  home: [
    { value: "brand", label: "A wellness, faith, or natural-living brand" },
    { value: "creator", label: "A podcaster or content creator" },
    { value: "venture", label: "Another aligned venture" },
    { value: "investor", label: "An investor" },
  ],
  homeschool: [
    { value: "coop", label: "A homeschool co-op leader" },
    { value: "pod", label: "A homeschool pod or microschool" },
    { value: "ministry", label: "A church or ministry program" },
    { value: "program", label: "Another educational program" },
  ],
};

const inputClass =
  "w-full px-4 py-3 bg-background border border-border font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-eden-gold transition-colors";
const labelClass =
  "block font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2";

export default function PartnerInquiryForm({ variant, bookingUrl }: Props) {
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [website, setWebsite] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const isInvestor = role === "investor";
  const isHomeschool = variant === "homeschool";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!role) {
      setError("Please choose what best describes you.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-partner-inquiry", {
        body: {
          inquiryType: role,
          sourcePage: variant,
          name,
          email,
          orgName: orgName || null,
          website: website || null,
          audienceSize: audienceSize || null,
          groupSize: isHomeschool && groupSize ? groupSize : null,
          message: message || null,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      try {
        metaTrack("Lead", { content_name: role, content_category: "partner" }, crypto.randomUUID());
      } catch (_e) { /* analytics is best-effort */ }
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    if (isInvestor) {
      return (
        <div className="max-w-md mx-auto text-center py-8">
          <p className="font-serif text-2xl mb-3" style={{ color: "hsl(var(--eden-bark))" }}>Thank you.</p>
          <p className="font-body text-muted-foreground leading-relaxed">
            We review investor inquiries personally and will be in touch shortly. We appreciate your interest in what we're building.
          </p>
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <p className="font-serif text-2xl mb-3" style={{ color: "hsl(var(--eden-bark))" }}>Thank you — let's talk.</p>
        <p className="font-body text-muted-foreground leading-relaxed mb-6">
          We've got your details. Grab a time that works and we'll meet you there.
        </p>
        <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="eden" size="xl" className="w-full">Book your call</Button>
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-5">
      <div>
        <label className={labelClass}>Which best describes you?</label>
        <div className="space-y-2">
          {ROLES[variant].map((r) => (
            <button
              type="button"
              key={r.value}
              onClick={() => setRole(r.value)}
              className={`w-full text-left px-4 py-3 border font-body transition-colors ${role === r.value ? "border-eden-gold bg-eden-gold/10 text-foreground" : "border-border text-muted-foreground hover:border-eden-gold/60"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {role && (
        <>
          <div>
            <label className={labelClass}>Your name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} placeholder="Your name" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="your@email.com" />
          </div>
          <div>
            <label className={labelClass}>{isHomeschool ? "Co-op / organization name" : "Business or show name"}</label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} placeholder={isHomeschool ? "Your group's name" : "Your brand, show, or company"} />
          </div>
          <div>
            <label className={labelClass}>Website or social</label>
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} placeholder="https://" />
          </div>
          {isHomeschool ? (
            <div>
              <label className={labelClass}>How many children?</label>
              <input type="number" min="1" value={groupSize} onChange={(e) => setGroupSize(e.target.value)} className={inputClass} placeholder="e.g. 18" />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Audience size (if relevant)</label>
              <input type="text" value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)} className={inputClass} placeholder="e.g. 12k newsletter, 30k downloads/mo" />
            </div>
          )}
          <div>
            <label className={labelClass}>What do you have in mind?</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={inputClass} placeholder="A sentence or two is plenty." />
          </div>
          {error && <p className="font-body text-sm text-destructive">{error}</p>}
          <Button variant="eden" size="xl" className="w-full" disabled={loading}>
            {loading ? "Sending…" : isInvestor ? "Submit inquiry" : "Continue to booking"}
          </Button>
          {isInvestor && (
            <p className="text-center font-body text-xs text-muted-foreground/70">
              We review investor inquiries personally before scheduling.
            </p>
          )}
        </>
      )}
    </form>
  );
}
