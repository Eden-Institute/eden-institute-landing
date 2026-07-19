// AI image generation and editing, client half (Ad Studio Phase 4).
//
// Thin by design: the brand lock, the palette, and the creative-range rules all
// live in the studio-image edge function so they cannot be inspected or
// weakened from the browser. This module sends the founder's own words and a
// range setting, and gets back an asset that is already in her library.

import { supabase } from "@/integrations/supabase/client";

export type CreativeRange = "strict" | "moderate" | "loose";

export interface ImageResult {
  assetId: string;
  storagePath: string;
  url: string | null;
  model: string;
  note: string;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("studio-image", { body });
  if (error) {
    let payload: { error?: string; detail?: unknown } | null = null;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try { payload = await ctx.json(); } catch { /* non-JSON body */ }
    }
    const err = new Error(payload?.error ?? error.message) as Error & {
      code?: string; detail?: unknown;
    };
    err.code = payload?.error;
    err.detail = payload?.detail;
    throw err;
  }
  return data as T;
}

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

/** Apply an AI edit to an image already in the library. The bytes never leave
 *  the server: only the storage path is sent. */
export function editImage(input: {
  prompt: string;
  range: CreativeRange;
  campaignTag: string;
  projectId: string;
  storagePath: string;
}): Promise<ImageResult> {
  return invoke<ImageResult>({ mode: "edit", ...input });
}
