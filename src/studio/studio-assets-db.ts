// Ad Studio Phase 2 data access: asset metadata.
//
// The studio-assets bucket stores bytes. studio_assets stores what we know
// about those bytes (tags, kind, provenance), without ever rewriting the
// uploaded file.
//
// 2026-07 audit note: the per-asset transform table (studio_asset_transforms)
// and the brand-kit reader were access paths for the retired five-screen
// wizard; the flow keeps its non-destructive adjustments in the project's own
// answers (`finetune`) and paints from the palette in flow-paint.ts. Their
// client code was removed here; the tables still exist and their history is in
// git if a future screen wants them.

import { supabase } from "@/integrations/supabase/client";

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

/** Metadata only. The caller removes the object from the bucket separately, so
 *  a storage failure never leaves a row pointing at a file that is still there. */
export async function forgetAsset(storagePath: string): Promise<void> {
  const { error } = await supabase
    .from("studio_assets")
    .delete()
    .eq("storage_path", storagePath);
  if (error) throw error;
}
