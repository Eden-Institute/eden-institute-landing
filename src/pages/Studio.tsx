// src/pages/Studio.tsx
//
// Founder-only ad workroom at /studio: generates Facebook/Instagram ad copy in
// the Eden voice (with Meta-policy + brand-voice compliance checks), renders
// finished ad images on canvas, and records credits-style video ads with music
// and narration.
//
// Phase 1 of the phased build added the layer the studio never had: campaigns
// are rows in public.studio_projects, so drafts, approvals, and founder notes
// survive a refresh. This page is now a thin orchestrator over three views;
// the studio core itself stays a self-contained vanilla-DOM app (src/studio/).
//
// Access boundary: RequireAuth at the route, the founder email check below, the
// studio-generate EF's own 403, and is_founder() RLS on studio_projects and
// both storage buckets. The client check is convenience; the server ones bite.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import StudioEntry from "@/studio/StudioEntry";
import StudioProjectList from "@/studio/StudioProjectList";
import StudioWorkroom from "@/studio/StudioWorkroom";
import {
  createProject, deleteProject, listProjects,
} from "@/studio/studio-db";
import type { NewStudioProject, StudioProject } from "@/studio/studio-db";
import { completeConnect } from "@/studio/studio-canva";

const FOUNDER_EMAIL = "hello@edeninstitute.health";

type View = "list" | "new" | "work";

export default function Studio() {
  const { user, loading: authLoading, signOut } = useAuth();
  const isFounder = !!user && user.email?.toLowerCase() === FOUNDER_EMAIL;

  const [view, setView] = useState<View>("list");
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [active, setActive] = useState<StudioProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      setProjects(await listProjects());
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : "Could not load your campaigns.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFounder) void refresh();
  }, [isFounder, refresh]);

  // Phase 3: /studio doubles as the Canva OAuth redirect target. On a normal
  // load completeConnect() returns null and this does nothing; after an
  // authorization it exchanges the code and reopens the project the founder
  // left from. State mismatches throw and are surfaced rather than swallowed.
  useEffect(() => {
    if (!isFounder) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await completeConnect();
        if (!result || cancelled) return;
        const list = await listProjects();
        if (cancelled) return;
        setProjects(list);
        const target = list.find((p) => p.id === result.projectId);
        if (target) { setActive(target); setView("work"); }
      } catch (err) {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : "Canva connection failed.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isFounder]);

  async function handleCreate(input: NewStudioProject) {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createProject(input);
      setProjects((cur) => [created, ...cur]);
      setActive(created);
      setView("work");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not start that campaign.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(p: StudioProject) {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const previous = projects;
    setProjects((cur) => cur.filter((x) => x.id !== p.id));
    try {
      await deleteProject(p.id);
    } catch (err) {
      // Put it back rather than leaving the list lying about what exists.
      setProjects(previous);
      setListError(
        err instanceof Error ? err.message : "Could not delete that campaign.",
      );
    }
  }

  const handleSaved = useCallback((saved: StudioProject) => {
    setProjects((cur) => cur.map((p) => (p.id === saved.id ? saved : p)));
    setActive((cur) => (cur && cur.id === saved.id ? { ...cur, ...saved } : cur));
  }, []);

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

  if (view === "work" && active) {
    return (
      <StudioWorkroom
        project={active}
        onSaved={handleSaved}
        onExit={() => {
          setActive(null);
          setView("list");
          void refresh();
        }}
        onFinish={() => {
          // "Start a New Campaign" now means exactly that: a new project row,
          // not a silent in-place reset of the one you just finished.
          setActive(null);
          setCreateError(null);
          setView("new");
          void refresh();
        }}
      />
    );
  }

  if (view === "new") {
    return (
      <StudioEntry
        busy={creating}
        error={createError}
        onCreate={handleCreate}
        onCancel={() => {
          setCreateError(null);
          setView("list");
        }}
      />
    );
  }

  return (
    <StudioProjectList
      projects={projects}
      loading={loading}
      error={listError}
      onNew={() => setView("new")}
      onOpen={(p) => {
        setActive(p);
        setView("work");
      }}
      onDelete={handleDelete}
    />
  );
}
