// Bridges from the framework-free studio core into Supabase.
//
// Extracted from src/pages/Studio.tsx in Phase 1 so that page can stay a thin
// orchestrator (list / entry / workroom) and the bridges can be shared.

import { supabase } from "@/integrations/supabase/client";
import {
  forgetAsset, getTransform, listAssets, loadBrandKit,
  recordAsset, retagAsset, saveTransform,
} from "./studio-assets-db";
import type { AssetTransform } from "./studio-assets-db";
import { editImage, generateImage, imageStatus } from "./studio-image";
import type { CreativeRange } from "./studio-image";

/** Bridge into the studio-generate EF (the multi-model AI engine). The vanilla
 *  studio core receives this as a plain async function so it stays
 *  framework-free. */
export async function aiInvoke(body: unknown): Promise<unknown> {
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

/** Phase 2: the bridge is now built per project, because an upload has to know
 *  which campaign it belongs to and which project it came from. */
export function makeAssetsBridge(ctx: {
  projectId: string;
  campaignTag: string;
}) {
  return { ...assetsBridge, ...projectAssetOps(ctx) };
}

function projectAssetOps(ctx: { projectId: string; campaignTag: string }) {
  return {
    /** Metadata-backed listing. `tag` of "all" or undefined returns everything. */
    async list(tag?: string): Promise<Array<{
      name: string; id: string; filename: string; kind: string; campaign_tag: string; source: string;
    }>> {
      const rows = await listAssets(tag);
      return rows.map((r) => ({
        name: r.storage_path,
        id: r.id,
        filename: r.filename,
        kind: r.kind,
        campaign_tag: r.campaign_tag,
        source: r.source,
      }));
    },
    /** Upload, then record metadata tagged with the project's campaign. If the
     *  metadata write fails the object is removed again, so the bucket and the
     *  table cannot drift apart.
     *
     *  Returns the storage path, which is what a saved ad has to remember: a
     *  signed URL expires within the hour and a blob: URL dies with the tab, so
     *  the path is the only durable handle on the file. */
    async upload(file: File): Promise<{ path: string }> {
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const path = `${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      try {
        await recordAsset({
          storagePath: path,
          filename: file.name,
          mimeType: file.type || null,
          campaignTag: ctx.campaignTag,
          projectId: ctx.projectId,
          sizeBytes: file.size ?? null,
        });
      } catch (err) {
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
        throw err;
      }
      return { path };
    },
    /** Remove the object first, then forget it. That order means a failure
     *  leaves an orphaned row (harmless, re-runnable) rather than a row-less
     *  file that the gallery can no longer see or delete. */
    async remove(name: string): Promise<void> {
      const { error } = await supabase.storage.from(BUCKET).remove([name]);
      if (error) throw error;
      await forgetAsset(name);
    },
    retag: retagAsset,
    brandKit: loadBrandKit,
    // Phase 4: AI image generation, pre-bound to this project and campaign so
    // generated images are tagged the same way uploads are.
    aiStatus: imageStatus,
    aiGenerate: (prompt: string, range: CreativeRange) =>
      generateImage({
        prompt, range, campaignTag: ctx.campaignTag, projectId: ctx.projectId,
      }),
    aiEdit: (prompt: string, range: CreativeRange, storagePath: string) =>
      editImage({
        prompt, range, campaignTag: ctx.campaignTag, projectId: ctx.projectId,
        storagePath,
      }),
    getTransform: (assetId: string) => getTransform(ctx.projectId, assetId),
    saveTransform: (assetId: string, t: AssetTransform) =>
      saveTransform(ctx.projectId, assetId, t),
  };
}

// list/upload/remove are supplied per-project by projectAssetOps (which is
// spread over this object in makeAssetsBridge), so only url and publish are ever
// reached from here. The shadowed versions were dead and have been removed.
export const assetsBridge = {
  async url(name: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(name, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
  // Publish a finished creative to the PUBLIC collateral bucket and return its
  // permanent hosted URL (required for email: Gmail strips data-URI images).
  async publish(blob: Blob, name: string): Promise<string> {
    const safe = name.replace(/[^\w.-]+/g, "_").slice(-80);
    const path = `${Date.now()}-${safe}`;
    const { error } = await supabase.storage
      .from("studio-collateral")
      .upload(path, blob, { contentType: "image/png" });
    if (error) throw error;
    return supabase.storage.from("studio-collateral").getPublicUrl(path).data.publicUrl;
  },
};
