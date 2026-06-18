import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { metaTrack } from "@/lib/metaPixel";

// Homepage "Get Involved" section — partner / collaborator / investor capture,
// styled in the homepage design system (honey/green tokens, Cormorant/EB
// Garamond). Submits to the shared submit-partner-inquiry EF. Investors get
// capture-then-approve (no inline link); aligned partners get the booking
// link; parents are routed to the curriculum.

const BOOKING_URL = "https://calendar.app.google/HRuPEVYU1UqYsLai6";
const SERIF = "'Cormorant Garamond', Georgia, serif";
const BODY = "'EB Garamond', Georgia, serif";

const ROLES = [
  { value: "brand", label: "A wellness, faith, or natural-living brand" },
  { value: "creator", label: "A podcaster or content creator" },
  { value: "venture", label: "Another aligned venture" },
  { value: "investor", label: "An investor" },
  { value: "parent", label: "A parent looking for the curriculum" },
];

const labelStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontWeight: 600,
  fontSize: "11px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "hsl(var(--green-mid))",
  marginBottom: "8px",
  display: "block",
};

const inputStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: "16px",
  width: "100%",
  padding: "11px 14px",
  border: "1px solid hsl(var(--sage-border) / 0.7)",
  borderRadius: "2px",
  color: "hsl(var(--ink))",
  backgroundColor: "#fff",
};

const primaryBtn: React.CSSProperties = {
  fontFamily: SERIF,
  fontWeight: 600,
  fontSize: "15px",
  letterSpacing: "0.06em",
  padding: "12px 28px",
  borderRadius: "2px",
  backgroundColor: "hsl(var(--honey))",
  color: "hsl(var(--green-deep))",
  border: "1px solid hsl(var(--honey))",
};

export default function GetInvolvedSection() {
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [website, setWebsite] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const isInvestor = role === "investor";
  const isParent = role === "parent";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-partner-inquiry", {
        body: {
          inquiryType: role,
          sourcePage: "home",
          name,
          email,
          orgName: orgName || null,
          website: website || null,
          audienceSize: audienceSize || null,
          message: message || null,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      try {
        metaTrack("Lead", { content_name: role, content_category: "partner" }, crypto.randomUUID());
      } catch (_e) {
        /* analytics is best-effort */
      }
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="get-involved"
      aria-label="Get involved"
      className="px-8"
      style={{
        backgroundColor: "hsl(var(--green-deep))",
        paddingTop: "clamp(60px, 8vw, 120px)",
        paddingBottom: "clamp(60px, 8vw, 120px)",
      }}
    >
      <div className="max-w-[760px] mx-auto text-center">
        <p
          className="uppercase tracking-[0.18em] mb-6"
          style={{ fontFamily: SERIF, fontWeight: 600, fontSize: "11px", color: "hsl(var(--honey-pale))" }}
        >
          GET INVOLVED
        </p>
        <h2
          className="mb-6"
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: "clamp(28px, 4vw, 48px)",
            lineHeight: 1.2,
            color: "hsl(var(--cream))",
          }}
        >
          Partner with Eden.
        </h2>
        <p
          className="mx-auto mb-10"
          style={{
            fontFamily: BODY,
            fontSize: "18px",
            color: "hsl(var(--sage-pale))",
            maxWidth: "600px",
            lineHeight: 1.6,
          }}
        >
          Eden grows through people who share the mission. If you run a business, host a podcast, lead a
          community, or want to back what we're building, we'd love to talk.
        </p>

        <div
          className="text-left mx-auto bg-white"
          style={{ maxWidth: "560px", borderRadius: "4px", borderTop: "3px solid hsl(var(--honey))", padding: "32px" }}
        >
          {done ? (
            isInvestor ? (
              <div className="text-center" style={{ padding: "16px 0" }}>
                <p style={{ fontFamily: SERIF, fontSize: "26px", color: "hsl(var(--green-deep))", marginBottom: "10px" }}>
                  Thank you.
                </p>
                <p style={{ fontFamily: BODY, fontSize: "16px", color: "hsl(var(--ink-soft))", lineHeight: 1.6 }}>
                  We review investor inquiries personally and will be in touch shortly. We appreciate your interest in
                  what we're building.
                </p>
              </div>
            ) : (
              <div className="text-center" style={{ padding: "16px 0" }}>
                <p style={{ fontFamily: SERIF, fontSize: "26px", color: "hsl(var(--green-deep))", marginBottom: "10px" }}>
                  Thank you — let's talk.
                </p>
                <p style={{ fontFamily: BODY, fontSize: "16px", color: "hsl(var(--ink-soft))", lineHeight: 1.6, marginBottom: "24px" }}>
                  We've got your details. Grab a time that works and we'll meet you there.
                </p>
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center min-h-[44px]"
                  style={primaryBtn}
                >
                  Book your call
                </a>
              </div>
            )
          ) : (
            <>
              <label style={labelStyle}>Which best describes you?</label>
              <div className="mb-2">
                {ROLES.map((r) => {
                  const selected = role === r.value;
                  return (
                    <button
                      type="button"
                      key={r.value}
                      onClick={() => {
                        setRole(r.value);
                        setDone(false);
                        setError("");
                      }}
                      className="w-full text-left min-h-[44px] transition-colors"
                      style={{
                        fontFamily: BODY,
                        fontSize: "16px",
                        padding: "11px 14px",
                        marginBottom: "8px",
                        borderRadius: "2px",
                        border: selected ? "1px solid hsl(var(--honey))" : "1px solid hsl(var(--sage-border) / 0.7)",
                        backgroundColor: selected ? "hsl(var(--honey) / 0.12)" : "#fff",
                        color: "hsl(var(--ink))",
                      }}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>

              {isParent && (
                <div style={{ marginTop: "16px" }}>
                  <p style={{ fontFamily: BODY, fontSize: "16px", color: "hsl(var(--ink-soft))", lineHeight: 1.6, marginBottom: "16px" }}>
                    Wonderful — that's the heart of Eden. Start with the free pattern quiz, or explore the homeschool
                    curriculum.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a href="/assessment" className="inline-flex items-center justify-center min-h-[44px]" style={primaryBtn}>
                      Take the Quiz
                    </a>
                    <a
                      href="/homeschool"
                      className="inline-flex items-center justify-center min-h-[44px]"
                      style={{
                        fontFamily: SERIF,
                        fontWeight: 600,
                        fontSize: "14px",
                        letterSpacing: "0.06em",
                        padding: "12px 28px",
                        borderRadius: "2px",
                        backgroundColor: "transparent",
                        color: "hsl(var(--green-deep))",
                        border: "1px solid hsl(var(--green-deep))",
                      }}
                    >
                      Eden's Table
                    </a>
                  </div>
                </div>
              )}

              {role && !isParent && (
                <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Your name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} placeholder="Your name" />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} placeholder="your@email.com" />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Business or show name</label>
                    <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} style={inputStyle} placeholder="Your brand, show, or company" />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Website or social</label>
                    <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} style={inputStyle} placeholder="https://" />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Audience size (if relevant)</label>
                    <input type="text" value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)} style={inputStyle} placeholder="e.g. 12k newsletter, 30k downloads/mo" />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>What do you have in mind?</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} style={inputStyle} placeholder="A sentence or two is plenty." />
                  </div>
                  {error && (
                    <p style={{ fontFamily: BODY, fontSize: "14px", color: "hsl(var(--rust))", marginBottom: "12px" }}>{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[44px] transition-colors"
                    style={{ ...primaryBtn, padding: "12px 20px", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? "Sending…" : isInvestor ? "Submit inquiry" : "Continue to booking"}
                  </button>
                  {isInvestor && (
                    <p className="text-center" style={{ fontFamily: BODY, fontSize: "12px", color: "hsl(var(--ink-soft))", marginTop: "10px" }}>
                      We review investor inquiries personally before scheduling.
                    </p>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
