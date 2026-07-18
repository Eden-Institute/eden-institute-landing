// The workroom: React chrome (project identity, saving, exit) wrapped around
// the vanilla studio core (drafts, creative builder, video builder, gallery).
//
// The core is deliberately NOT ported. It is a working canvas/MediaRecorder app
// and React buys it nothing. What Phase 1 adds is the thing it never had: the
// session is a row in the database, so a refresh no longer destroys the work.
//
// Saving is manual by design (founder decision, spec §0.1). Nothing is written
// without a click, so this component has to be loud about unsaved work: a dirty
// badge in the header and a beforeunload guard.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { STUDIO_HTML } from "@/studio/studio-html";
import { initStudio } from "@/studio/studio-core";
import { aiInvoke, makeAssetsBridge } from "./studio-bridges";
import {
  beginConnect, exportToCanva, reimportFromCanva, status as canvaStatus,
} from "./studio-canva";
import { recordExportBatch } from "./studio-exports-db";
import { formatForAdType } from "./studio-types";
import type { StudioHandle } from "./studio-types";
import { saveProject } from "./studio-db";
import type { StudioProject } from "./studio-db";
import "@/studio/studio.css";

/** How often the shell asks the core whether anything changed. The core has no
 *  change events (it is a DOM app with dozens of mutation points), and polling a
 *  small plain-data snapshot is both cheaper and more honest than instrumenting
 *  every one of them and silently missing some. */
const DIRTY_POLL_MS = 1500;

interface Props {
  project: StudioProject;
  onExit: () => void;
  /** The wizard's last step. Finishing means starting a NEW campaign, which
   *  used to reset the current one in place and lose the founder's position. */
  onFinish: () => void;
  /** Bubble the saved row up so the list reflects the new updated_at / title. */
  onSaved: (p: StudioProject) => void;
}

export default function StudioWorkroom({ project, onExit, onFinish, onSaved }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const handleRef = useRef<StudioHandle | null>(null);
  const savedSnapshotRef = useRef<string>("");

  // Measured, not hardcoded: the header wraps on narrow screens (tablet is a
  // supported target), and a stale value would either clip the studio or leave
  // a gap. 61 is only the pre-measurement estimate.
  const [headerH, setHeaderH] = useState(61);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Held in a ref so the mount effect never re-runs just because a parent
  // callback identity changed; remounting the core would drop the session.
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  // The core calls onFinish from outside React, so the guard needs the current
  // dirty value rather than the one captured at mount.
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      setHeaderH(h);
      mountRef.current?.style.setProperty("--studio-shell-top", `${h}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mount the core once per project. project.id in the dep array means opening a
  // different project tears the old core down and rebuilds it, which is what we
  // want: the core holds a whole session's worth of closure state.
  useEffect(() => {
    const root = mountRef.current;
    if (!root) return;

    // The studio's own step pills are sticky at top:0, exactly where this
    // component's header sits. Push them below it or they cover Save draft.
    const headerH = headerRef.current?.offsetHeight ?? 0;
    root.style.setProperty("--studio-shell-top", `${headerH}px`);

    root.innerHTML = STUDIO_HTML;
    // Phase 2: uploads are tagged with this project's campaign, and transforms
    // are scoped to this project, so the bridge needs that context.
    const assets = makeAssetsBridge({
      projectId: project.id,
      campaignTag: project.campaign_tag,
    });
    // Phase 3: the Canva bridge is pre-bound to this project so the vanilla
    // core never has to know about project ids or Supabase.
    const canva = {
      projectId: project.id,
      designId: project.canva_design_id ?? null,
      editUrl: project.canva_edit_url ?? null,
      status: canvaStatus,
      beginConnect: () => beginConnect(project.id),
      exportToCanva: (i: {
        pngBase64: string; title: string; width: number; height: number;
        assetId?: string | null;
      }) => exportToCanva({ projectId: project.id, ...i }),
      reimportFromCanva: () => reimportFromCanva(project.id),
    };
    // Phase 7: export records, pre-bound to this project.
    const exportsBridge = {
      record: async (files: Parameters<typeof recordExportBatch>[1]) => {
        await recordExportBatch(project.id, files);
      },
    };
    const handle = initStudio(root, aiInvoke, assets, {
      // The core auto-advances on its own (heroGo jumps to Drafts). Treating
      // that as a change keeps the dirty badge truthful.
      onStep: () => setDirty(true),
      onFinish: () => {
        if (dirtyRef.current &&
            !window.confirm("This campaign has unsaved changes. Start a new one anyway?")) {
          return;
        }
        finishRef.current();
      },
    }, canva, exportsBridge);
    handleRef.current = handle;

    // Restore the saved session, then seed anything the entry screen decided
    // that the blob does not carry yet (a brand-new project has an empty state).
    handle.applyState(project.state);
    if (!project.state || Object.keys(project.state).length === 0) {
      handle.applyState({
        campaign: {
          product: project.product,
          format: formatForAdType(project.ad_type),
        },
      });
    }
    handle.showStep(project.current_step ?? 0);

    savedSnapshotRef.current = JSON.stringify(handle.getState());
    setDirty(false);

    return () => {
      handle.destroy();
      handleRef.current = null;
      root.innerHTML = "";
    };
    // project.state / current_step are the load-time seed only; re-running on
    // every save would blow away in-flight edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Dirty polling.
  useEffect(() => {
    const t = window.setInterval(() => {
      const handle = handleRef.current;
      if (!handle) return;
      try {
        setDirty(JSON.stringify(handle.getState()) !== savedSnapshotRef.current);
      } catch {
        /* a snapshot mid-render is not worth surfacing; the next tick retries */
      }
    }, DIRTY_POLL_MS);
    return () => window.clearInterval(t);
  }, []);

  // No autosave means a refresh can still lose work. Say so before it happens.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle || saving) return;
    setSaving(true);
    setSaveError(null);
    const snapshot = handle.getState();
    try {
      const saved = await saveProject(project.id, {
        state: snapshot,
        current_step: handle.getStep(),
      });
      // Snapshot what we actually sent, not a fresh read: the founder may have
      // typed during the round-trip and that edit is genuinely still unsaved.
      savedSnapshotRef.current = JSON.stringify(snapshot);
      setDirty(JSON.stringify(handle.getState()) !== savedSnapshotRef.current);
      setSavedAt(new Date().toLocaleTimeString());
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [project.id, saving, onSaved]);

  function exit() {
    if (dirty && !window.confirm("This campaign has unsaved changes. Leave anyway?")) {
      return;
    }
    onExit();
  }

  return (
    <div>
      {/* NOT sticky. A global `body { overflow-x: hidden }` turns body into a
          scroll container, which silently kills position:sticky everywhere on
          the page (the studio's own step pills are broken the same way). fixed
          + a spacer is immune to that, and Save draft has to stay reachable:
          without it there is no way to persist a campaign at all. */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/95 backdrop-blur"
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={exit} className="shrink-0">
            ← Campaigns
          </Button>
          <div className="min-w-0 flex-1">
            <p
              className="font-serif text-sm font-semibold truncate"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {project.title}
            </p>
            <p className="font-body text-xs text-muted-foreground">
              {dirty ? (
                <span style={{ color: "hsl(var(--eden-gold))" }}>Unsaved changes</span>
              ) : savedAt ? (
                `Saved ${savedAt}`
              ) : (
                "No changes yet"
              )}
              {saveError && (
                <span className="text-destructive"> · {saveError}</span>
              )}
            </p>
          </div>
          <Button
            variant="eden"
            size="sm"
            onClick={save}
            disabled={saving || !dirty}
            className="shrink-0"
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </header>

      {/* Reserves the space the fixed header occupies. */}
      <div style={{ height: headerH }} aria-hidden />

      <div ref={mountRef} className="edenstudio" />
    </div>
  );
}
