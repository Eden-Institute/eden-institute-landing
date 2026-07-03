import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { FullGuideContent } from "@/lib/guide-types";
import GuideTemplate from "@/components/guide/GuideTemplate";
import Navbar from "@/components/landing/Navbar";
import { ROUTES } from "@/lib/routes";

const GuideSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [guide, setGuide] = useState<FullGuideContent | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      navigate(ROUTES.ASSESSMENT);
      return;
    }

    const verify = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("verify-session", {
          body: { session_id: sessionId },
        });

        if (fnError) throw fnError;
        if (!data?.paid) throw new Error("Payment not verified");

        setNickname(data.constitution_nickname);
        if (data.guide) setGuide(data.guide as FullGuideContent);
      } catch (err: any) {
        setError(err.message || "Payment verification failed");
        setTimeout(() => navigate(ROUTES.ASSESSMENT), 3000);
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-[calc(100vh-72px)] flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
          <div className="text-center">
            <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "#C5A44E", borderTopColor: "transparent" }} />
            <p className="font-serif text-lg" style={{ color: "#2C3E2D" }}>Verifying your purchase…</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !nickname) {
    return (
      <>
        <Navbar />
        <div className="min-h-[calc(100vh-72px)] flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
          <div className="text-center max-w-md px-6">
            <p className="font-serif text-xl mb-4" style={{ color: "#2C3E2D" }}>Payment verification failed</p>
            <p className="font-body text-sm" style={{ color: "#6B6560" }}>Redirecting you back to the assessment…</p>
          </div>
        </div>
      </>
    );
  }

  if (guide) {
    return (
      <>
        <Navbar />
        <GuideTemplate guide={guide} />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
        <div className="text-center max-w-md px-6">
          <p className="font-serif text-xl mb-4" style={{ color: "#2C3E2D" }}>Guide not found</p>
          <p className="font-body text-sm" style={{ color: "#6B6560" }}>We couldn't load your guide. Please contact support.</p>
        </div>
      </div>
    </>
  );
};

export default GuideSuccess;
