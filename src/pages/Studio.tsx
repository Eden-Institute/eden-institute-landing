// src/pages/Studio.tsx
//
// Founder-only ad workroom at /studio: generates Facebook/Instagram ad copy in
// the Eden voice (with Meta-policy + brand-voice compliance checks), renders
// finished ad images on canvas, and records credits-style video ads with music
// and narration. Everything runs client-side; nothing is uploaded and there is
// no server data surface, so the access boundary is the founder gate itself
// (RequireAuth at the route + the founder email check below, same as /founder).
//
// The studio core is a self-contained vanilla-DOM app (src/studio/), ported
// from the founder's standalone Ad Studio build. It mounts into a ref and
// tears down fully on unmount.

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { STUDIO_HTML } from "@/studio/studio-html";
import { initStudio } from "@/studio/studio-core";
import "@/studio/studio.css";

const FOUNDER_EMAIL = "hello@edeninstitute.health";

export default function Studio() {
  const { user, loading: authLoading, signOut } = useAuth();
  const isFounder = !!user && user.email?.toLowerCase() === FOUNDER_EMAIL;
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFounder) return;
    const root = mountRef.current;
    if (!root) return;
    root.innerHTML = STUDIO_HTML;
    const cleanup = initStudio(root);
    return () => {
      cleanup();
      root.innerHTML = "";
    };
  }, [isFounder]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-body text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isFounder) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="max-w-md text-center">
          <p className="font-accent text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "hsl(var(--eden-gold))" }}>
            Restricted
          </p>
          <h1 className="font-serif text-2xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>
            Founder access only
          </h1>
          <p className="font-body text-muted-foreground mb-6">
            The Ad Studio is limited to the Eden Institute founder account. You're signed in as{" "}
            {user?.email ?? "an unknown account"}.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
            <Button asChild variant="eden"><Link to={ROUTES.HOME}>Home</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="edenstudio" />;
}
