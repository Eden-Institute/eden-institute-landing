// Ad Studio Phase 2 data access: asset metadata, non-destructive transforms,
// and the locked brand kit.
//
// The studio-assets bucket stores bytes. These tables store what we know about
// those bytes (tags, kind, provenance) and what the founder has done to them
// (opacity, crop, colour), without ever rewriting the uploaded file.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface StudioAsset {
  id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  kind: "image" | "video";
  campaign_tag: string;
  project_id: string | null;
  size_bytes: number | null;
  /** Where the bytes came from. Phase 4 adds ai_generated. */
  source: "upload" | "ai_generated" | "canva";
  ai_prompt: string | null;
  created_at: string;
}

export interface AssetTransform {
  opacity: number;
  /** { x, y, scale } in canvas-relative units. */
  crop: { x?: number; y?: number; scale?: number };
  /** Each 0..2, where 1 is unchanged. */
  color_adjust: { brightness?: number; contrast?: number; saturation?: number };
}

export const DEFAULT_TRANSFORM: AssetTransform = {
  opacity: 1,
  crop: { x: 0, y: 0, scale: 1 },
  color_adjust: { brightness: 1, contrast: 1, saturation: 1 },
};

export interface BrandToken {
  kind: "color" | "font";
  token_key: string;
  label: string;
  value: string;
  usage: string | null;
  sort_order: number;
}

// ── Assets ──────────────────────────────────────────────────────────────────

export async function listAssets(tag?: string): Promise<StudioAsset[]> {
  let q = supabase
    .from("studio_assets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(400);
  if (tag && tag !== "all") q = q.eq("campaign_tag", tag);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StudioAsset[];
}

/** Record metadata for a file already uploaded to the bucket. */
export async function recordAsset(input: {
  storagePath: string;
  filename: string;
  mimeType: string | null;
  campaignTag: string;
  projectId: string | null;
  sizeBytes: number | null;
}): Promise<StudioAsset> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in.");

  const { data, error } = await supabase
    .from("studio_assets")
    .insert({
      created_by: uid,
      storage_path: input.storagePath,
      filename: input.filename,
      mime_type: input.mimeType,
      kind: (input.mimeType ?? "").startsWith("video/") ? "video" : "image",
      campaign_tag: input.campaignTag,
      project_id: input.projectId,
      size_bytes: input.sizeBytes,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as StudioAsset;
}

export async function retagAsset(id: string, tag: string): Promise<void> {
  const { error } = await supabase
    .from("studio_assets")
    .update({ campaign_tag: tag })
    .eq("id", id);
  if (error) throw error;
}

/** Metadata only. The caller removes the object from the bucket separately, so
 *  a storage failure never leaves a row pointing at a file that is still there. */
export async function forgetAsset(storagePath: string): Promise<void> {
  const { error } = await supabase
    .from("studio_assets")
    .delete()
    .eq("storage_path", storagePath);
  if (error) throw error;
}

// ── Transforms ──────────────────────────────────────────────────────────────

export async function getTransform(
  projectId: string, assetId: string,
): Promise<AssetTransform> {
  const { data, error } = await supabase
    .from("studio_asset_transforms")
    .select("opacity, crop, color_adjust")
    .eq("project_id", projectId)
    .eq("asset_id", assetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...DEFAULT_TRANSFORM };
  return {
    opacity: Number(data.opacity ?? 1),
    crop: (data.crop ?? {}) as AssetTransform["crop"],
    color_adjust: (data.color_adjust ?? {}) as AssetTransform["color_adjust"],
  };
}

export async function saveTransform(
  projectId: string, assetId: string, t: AssetTransform,
): Promise<void> {
  const { error } = await supabase
    .from("studio_asset_transforms")
    .upsert({
      project_id: projectId,
      asset_id: assetId,
      opacity: t.opacity,
      crop: t.crop as unknown as Json,
      color_adjust: t.color_adjust as unknown as Json,
    }, { onConflict: "project_id,asset_id" });
  if (error) throw error;
}

// ── Brand kit ───────────────────────────────────────────────────────────────

/** Read-only by database policy: there is no write path from the client. */
export async function loadBrandKit(): Promise<BrandToken[]> {
  const { data, error } = await supabase
    .from("studio_brand_tokens")
    .select("kind, token_key, label, value, usage, sort_order")
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BrandToken[];
}
