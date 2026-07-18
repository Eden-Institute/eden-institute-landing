// Bridges from the framework-free studio core into Supabase.
//
// Extracted from src/pages/Studio.tsx in Phase 1 so that page can stay a thin
// orchestrator (list / entry / workroom) and the bridges can be shared.

import { supabase } from "@/integrations/supabase/client";

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

export const assetsBridge = {
  async list(): Promise<Array<{ name: string }>> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    return (data ?? []).filter((f) => f.name && !f.name.startsWith("."));
  },
  async upload(file: File): Promise<void> {
    const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
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
