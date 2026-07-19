// AI image generation and editing, client half (Ad Studio Phase 4).
//
// Thin by design: the brand lock, the palette, and the creative-range rules all
// live in the studio-image edge function so they cannot be inspected or
// weakened from the browser. This module sends the founder's own words and a
// range setting, and gets back an asset that is already in her library.

import { invokeStudioFunction } from "./studio-invoke";

export type CreativeRange = "strict" | "moderate" | "loose";

export interface ImageResult {
  assetId: string;
  storagePath: string;
  url: string | null;
  model: string;
  note: string;
}

const invoke = <T,>(body: Record<string, unknown>) =>
  invokeStudioFunction<T>("studio-image", body);

export function imageStatus(): Promise<{ configured: boolean; model: string }> {
  return invoke({ mode: "status" });
}

/** Generate a new image from a text brief. */
export function generateImage(input: {
  prompt: string;
  range: CreativeRange;
  campaignTag: string;
  projectId: string;
}): Promise<ImageResult> {
  return invoke<ImageResult>({ mode: "generate", ...input });
}

// The studio-image EF also supports an `edit` mode (AI edits to an image
// already in the bucket, addressed by storage path so bytes never leave the
// server). Its client call was removed with the old wizard; restore from git
// when an edit UI exists to call it.
