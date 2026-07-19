// Making a chosen photo or clip survive a refresh.
//
// A slide can be pointed at its file three different ways and only one of them
// lasts:
//
//   url  · a blob: URL for a file still only in this tab. Dies with the tab.
//   path · where it lives in the studio-assets bucket. Durable, and the only
//          thing worth saving.
//   a signed URL minted from that path, good for about an hour.
//
// So `path` is what gets persisted, and a fresh signed URL is minted whenever a
// campaign is opened. Saving a signed URL and reloading it later is the bug
// this module exists to prevent: it looks fine until the ad is reopened
// tomorrow and every picture is gone.

import type { SlideAnswer } from "./flow-graph";

export interface AssetsPort {
  list: (tag?: string) => Promise<Array<{
    name: string; id: string; filename: string; kind: string;
    campaign_tag: string; source: string;
  }>>;
  upload: (file: File) => Promise<{ path: string }>;
  url: (name: string) => Promise<string>;
  remove: (name: string) => Promise<void>;
  /** Is the image engine configured? Optional: a session without it still has
   *  uploads and the branded template. */
  aiStatus?: () => Promise<{ configured: boolean; model: string }>;
  /** Generate an Eden-styled image; the result is already a saved asset. */
  aiGenerate?: (prompt: string, range: "strict" | "moderate" | "loose") =>
    Promise<{ assetId: string; storagePath: string; url: string | null }>;
}

/** A slide is only truly saved once it has a bucket path. */
export const isPersisted = (s: SlideAnswer) => !!s.path;

/** Slides that would vanish on refresh, so the UI can say so honestly. */
export const unsavedSlides = (slides: SlideAnswer[] = []) =>
  slides.filter((s) => !isPersisted(s));

export function kindForMime(mime: string): SlideAnswer["kind"] {
  return /^video\//.test(mime) ? "video" : "image";
}

/**
 * Put a file in the bucket and hand back a slide that will survive a refresh.
 *
 * The local blob: URL is kept as the slide's `url` so the preview paints
 * immediately rather than waiting on a round-trip, and `path` is what makes it
 * durable. If the upload fails the slide is still returned, unsaved, because
 * losing the founder's work over a network blip would be worse than telling
 * her it is not saved yet.
 */
export async function uploadSlide(
  file: File,
  assets: AssetsPort | undefined,
  localUrl: string,
): Promise<{ slide: SlideAnswer; error: string | null }> {
  const slide: SlideAnswer = {
    id: `local-${Date.now()}-${Math.round((file.size || 0) % 9973)}`,
    kind: kindForMime(file.type || ""),
    url: localUrl,
    own: true,
    name: file.name,
  };
  if (!assets) return { slide, error: null };
  try {
    const { path } = await assets.upload(file);
    return { slide: { ...slide, id: path, path }, error: null };
  } catch (err) {
    return {
      slide,
      error: err instanceof Error
        ? `Saved to this session only: ${err.message}`
        : "Saved to this session only. It will not survive a refresh.",
    };
  }
}

/**
 * Mint fresh signed URLs for anything that has a bucket path.
 *
 * Called when a campaign is opened. Anything whose file only ever lived in the
 * browser cannot be recovered, so it is dropped rather than left pointing at a
 * dead blob: URL that would paint as a broken frame.
 */
export async function resolveSlideUrls(
  slides: SlideAnswer[] | undefined,
  assets: AssetsPort | undefined,
): Promise<{ slides: SlideAnswer[]; lost: number }> {
  if (!slides?.length) return { slides: slides ?? [], lost: 0 };
  if (!assets) return { slides, lost: 0 };

  const out: SlideAnswer[] = [];
  let lost = 0;
  for (const s of slides) {
    if (!s.path) {
      // A blob: URL from a previous session is already dead.
      if (s.url?.startsWith("blob:")) { lost += 1; continue; }
      out.push(s);
      continue;
    }
    try {
      out.push({ ...s, url: await assets.url(s.path) });
    } catch {
      lost += 1;               // in the bucket but unreadable right now
    }
  }
  return { slides: out, lost };
}

/** Saved assets, newest first, as slides ready to drop straight onto an ad. */
export async function listSavedSlides(
  assets: AssetsPort | undefined,
  campaignTag?: string,
): Promise<SlideAnswer[]> {
  if (!assets) return [];
  const rows = await assets.list(campaignTag);
  return rows.map((r) => ({
    id: r.name,
    path: r.name,
    kind: (r.kind === "video" ? "video" : "image") as SlideAnswer["kind"],
    name: r.filename,
    own: r.source === "upload",
  }));
}

/** A signed URL for one saved asset, fetched only when it is actually shown. */
export async function signedUrlFor(
  slide: SlideAnswer, assets: AssetsPort | undefined,
): Promise<string | null> {
  if (!slide.path || !assets) return slide.url ?? null;
  try { return await assets.url(slide.path); } catch { return null; }
}
