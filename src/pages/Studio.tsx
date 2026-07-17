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
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { STUDIO_HTML } from "@/studio/studio-html";
import { initStudio } from "@/studio/studio-core";
import "@/studio/studio.css";

// Bridge into the studio-generate EF (the multi-model AI engine). The vanilla
// studio core receives this as a plain async function so it stays framework-free.
async function aiInvoke(body: unknown): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("studio-generate", { body });
  if (error) {
    // FunctionsHttpError carries a fixed generic message; the EF's real error
    // code and detail live on error.context (the Response). Surface them so
    // the studio can branch on code, not on message text.
    let payload: { error?: string; detail?: unknown } | null = null;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try { payload = await ctx.json(); } catch { /* non-JSON body */ }
    }
    const err = new Error(payload?.error ?? error.message) as Error & {
      code?: string; status?: number; detail?: unknown;
    };
    err.code = payload?.error;
    err.status = ctx?.status;
    err.detail = payload?.detail;
    throw err;
  }
  return data;
}

// Bridge into the private studio-assets bucket (founder-only via storage RLS).
// The gallery reads through short-lived signed URLs; nothing is ever public.
const BUCKET = "studio-assets";
const assetsBridge = {
  async list(): Promise<Array<{ name: string }>> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    return (data ?? []).filter((f) => f.name && !f.name.startsWith("."));
  },
  async upload(file: File): Promise<void> {
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${Date.now()}-${safe}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (error) throw error;
  },
  async url(name: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(name, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
  async remove(name: string): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET).remove([name]);
    if (error) throw error;
  },
};

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
    const cleanup = initStudio(root, aiInvoke, assetsBridge);
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
