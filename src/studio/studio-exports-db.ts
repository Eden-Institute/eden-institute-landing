// Export records (Ad Studio Phase 7).
//
// The download is the deliverable; this is the paper trail. Phase 8's archive
// reads these rows to show what a project actually produced, so an export that
// never gets recorded is a project that looks unfinished forever.

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "studio-exports";

export interface ExportFile {
  format: string;
  aspect_ratio: string;
  width: number;
  height: number;
  bytes: Uint8Array;
  name: string;
  /** Defaults to image/png; the video path records video/mp4 or video/webm. */
  mime?: string;
}

/**
 * Store each rendered size and record it, then mark the project exported.
 *
 * All files from one click share a batch_id so the archive can show "three
 * sizes exported at 14:02" rather than three unrelated rows.
 */
export async function recordExportBatch(
  projectId: string, files: ExportFile[],
): Promise<{ batchId: string; stored: number }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in.");

  const batchId = crypto.randomUUID();
  const rows: Array<{
    created_by: string;
    project_id: string;
    format: string;
    aspect_ratio: string;
    width: number;
    height: number;
    storage_path: string | null;
    batch_id: string;
  }> = [];

  for (const f of files) {
    // The name reaches a storage key; strip anything that could nest or
    // traverse. projectId/batchId are UUIDs we minted ourselves.
    const safeName = f.name.replace(/[^\w.-]+/g, "_").slice(-80) || "export";
    const path = `${projectId}/${batchId}/${safeName}`;
    const mime = f.mime ?? "image/png";
    // A storage failure should not lose the whole batch: record the row with a
    // null path so the archive still shows the export happened.
    let storagePath: string | null = null;
    const up = await supabase.storage
      .from(BUCKET)
      .upload(path, new Blob([f.bytes as unknown as BlobPart], { type: mime }), {
        contentType: mime,
        upsert: true,
      });
    if (!up.error) storagePath = path;

    rows.push({
      created_by: uid,
      project_id: projectId,
      format: f.format,
      aspect_ratio: f.aspect_ratio,
      width: f.width,
      height: f.height,
      storage_path: storagePath,
      batch_id: batchId,
    });
  }

  const { error } = await supabase.from("studio_exports").insert(rows);
  if (error) throw error;

  // Status is a fact about the project, not about this batch, so it is set
  // once the rows land rather than per file. Surfaced like the insert above: a
  // swallowed failure here would leave the project reading "draft" in the
  // archive forever even though its export rows exist.
  const { error: statusError } = await supabase.from("studio_projects")
    .update({ status: "exported" })
    .eq("id", projectId);
  if (statusError) throw statusError;

  return { batchId, stored: rows.filter((r) => r.storage_path).length };
}
