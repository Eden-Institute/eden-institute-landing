// The workroom: React chrome (project identity, saving, exit) wrapped around
// the ad flow.
//
// The flow replaced the vanilla studio core here. That core put every control
// on screen at once across five screens, which is exactly what made it
// unusable, so there is deliberately no fallback to it: the founder asked for
// the new flow to replace it outright.
//
// Saving is manual by design (founder decision, spec §0.1). Nothing is written
// without a click, so this component has to be loud about unsaved work: a dirty
// badge in the header and a beforeunload guard.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import StudioFlow from "./StudioFlow";
import type { ExportedFile } from "./StudioFlow";
import type { FlowAnswers } from "./flow-graph";
import { aiInvoke, makeAssetsBridge } from "./studio-bridges";
import { resolveSlideUrls } from "./flow-assets";
import { recordExportBatch } from "./studio-exports-db";
import { adTypeForFormat, formatForAdType } from "./studio-types";
import { saveProject } from "./studio-db";
import type { StudioProject } from "./studio-db";

interface Props {
  project: StudioProject;
  onExit: () => void;
  /** Finishing means starting a NEW campaign, which must not reset the current
   *  one in place and lose the founder's position. */
  onFinish: () => void;
  /** Bubble the saved row up so the list reflects the new updated_at / title. */
  onSaved: (p: StudioProject) => void;
}

/** Answers live under their own key so the rest of `state` stays free for
 *  whatever the export step wants to record alongside them. */
function seedAnswers(project: StudioProject): FlowAnswers {
  const saved = (project.state as { flow?: FlowAnswers } | null)?.flow;
  if (saved && Object.keys(saved).length) return saved;
  // A brand-new project already knows part of the brief from the entry screen,
  // so those questions should arrive already answered rather than asked twice.
  return {
    product: project.product || undefined,
    adType: (formatForAdType(project.ad_type) as FlowAnswers["adType"]) || undefined,
    platforms: project.platforms?.length === 2
      ? "both"
      : (project.platforms?.[0] as FlowAnswers["platforms"]) || undefined,
  };
}

export default function StudioWorkroom({ project, onExit, onFinish, onSaved }: Props) {
  const headerRef = useRef<HTMLElement>(null);
  const savedSnapshotRef = useRef<string>("");

  // Measured, not hardcoded: the header wraps on narrow screens (tablet is a
  // supported target), and a stale value would either clip the flow or leave a
  // gap. 61 is only the pre-measurement estimate.
  const [headerH, setHeaderH] = useState(61);
  const [answers, setAnswers] = useState<FlowAnswers>(() => seedAnswers(project));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [lostMedia, setLostMedia] = useState(0);

  // Uploads are tagged with this project's campaign and transforms are scoped
  // to it, so the bridge needs that context.
  const assets = useMemo(
    () => makeAssetsBridge({ projectId: project.id, campaignTag: project.campaign_tag }),
    [project.id, project.campaign_tag],
  );
  // The open-a-project effect runs before render finishes, so it reads the
  // bridge through a ref rather than depending on it and re-running.
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  // Re-seed when a different project is opened. Answers are plain data, so
  // unlike the old core there is no session to tear down.
  useEffect(() => {
    const seeded = seedAnswers(project);
    setAnswers(seeded);
    savedSnapshotRef.current = JSON.stringify(seeded);
    setSavedAt(null);
    setSaveError(null);
    setLostMedia(0);
    // A saved signed URL has expired and a saved blob: URL died with the tab
    // that made it, so the pictures have to be re-pointed from their bucket
    // paths or a reopened campaign paints as broken frames.
    let live = true;
    void (async () => {
      const { slides, lost } = await resolveSlideUrls(seeded.slides, assetsRef.current);
      if (!live) return;
      if (lost) setLostMedia(lost);
      if (lost || slides.some((sl, i) => sl.url !== seeded.slides?.[i]?.url)) {
        // Refreshed URLs are not an edit, so the snapshot moves with them and
        // simply opening a campaign does not mark it unsaved.
        const next = { ...seeded, slides };
        setAnswers(next);
        savedSnapshotRef.current = JSON.stringify(next);
      }
    })();
    return () => { live = false; };
    // project.state is the load-time seed only; re-running on every save would
    // blow away in-flight edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const dirty = JSON.stringify(answers) !== savedSnapshotRef.current;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // No autosave means a refresh can still lose work. Say so before it happens.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const snapshot = answers;
    try {
      const saved = await saveProject(project.id, {
        state: { ...((project.state as object) ?? {}), flow: snapshot },
        // Keep the archive's facets truthful. They are real columns the
        // campaign list filters on, so a brief changed inside the flow has to
        // reach them or the project files itself under the wrong campaign.
        ...(snapshot.product ? { product: snapshot.product } : {}),
        ...(snapshot.adType ? { ad_type: adTypeForFormat(snapshot.adType) } : {}),
        ...(snapshot.platforms
          ? {
            platforms: snapshot.platforms === "both"
              ? ["instagram", "facebook"]
              : [snapshot.platforms],
          }
          : {}),
      });
      // Snapshot what we actually sent, not a fresh read: the founder may have
      // typed during the round-trip and that edit is genuinely still unsaved.
      savedSnapshotRef.current = JSON.stringify(snapshot);
      setSavedAt(new Date().toLocaleTimeString());
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [answers, project.id, project.state, saving, onSaved]);

  function exit() {
    if (dirty && !window.confirm("This campaign has unsaved changes. Leave anyway?")) return;
    onExit();
  }

  function finish() {
    if (dirtyRef.current
      && !window.confirm("This campaign has unsaved changes. Start a new one anyway?")) return;
    onFinish();
  }

  // Phase 7 paper trail: every successful save/download becomes a row in
  // studio_exports (and the file lands in the studio-exports bucket), so the
  // archive can show what a campaign actually produced. Fire-and-forget: the
  // founder already has her file, so a logging failure only logs.
  const recordExport = useCallback((file: ExportedFile) => {
    void (async () => {
      try {
        const bytes = new Uint8Array(await file.blob.arrayBuffer());
        await recordExportBatch(project.id, [{
          format: file.format,
          aspect_ratio: `${file.width}x${file.height}`,
          width: file.width,
          height: file.height,
          bytes,
          name: file.name,
          mime: file.blob.type || undefined,
        }]);
      } catch (err) {
        console.warn("export record failed (file already saved):", err);
      }
    })();
  }, [project.id]);

  return (
    <div>
      {/* NOT sticky. A global `body { overflow-x: hidden }` turns body into a
          scroll container, which silently kills position:sticky everywhere on
          the page. fixed + a spacer is immune to that, and Save draft has to
          stay reachable: without it there is no way to persist a campaign. */}
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
              {saveError && <span className="text-destructive"> · {saveError}</span>}
              {lostMedia > 0 && (
                <span className="text-destructive">
                  {" "}· {lostMedia === 1 ? "one picture was" : `${lostMedia} pictures were`}
                  {" "}never saved to your library and could not be restored
                </span>
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

      <StudioFlow
        answers={answers}
        onChange={setAnswers}
        assets={assets}
        ai={aiInvoke}
        onFinish={finish}
        onExported={recordExport}
      />
    </div>
  );
}
