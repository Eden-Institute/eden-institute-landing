// Persistence for /studio campaign projects (Ad Studio Phase 1).
//
// The client is fully typed here: PR #286 regenerated types.ts, so the cast
// this file used to carry is gone.
//
// One narrowing remains and is deliberate. Postgres jsonb generates as `Json`,
// which is true but useless to callers: `state` and `slides` have real shapes
// that the studio depends on. StudioProject re-types those two fields, and
// toProject() is the single place the widening is undone, so every caller below
// gets StudioStateBlob and StudioSlide[] instead of Json.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { StudioSlide, StudioStateBlob } from "./studio-types";

const TABLE = "studio_projects";

export interface StudioProject {
  id: string;
  created_by: string;
  title: string;
  product: string;
  platforms: string[];
  ad_type: string;
  campaign_tag: string;
  current_step: number;
  status: "draft" | "exported" | "archived";
  state: StudioStateBlob;
  slides: StudioSlide[];
  /** Phase 3: the Canva design this project round-trips through, if any. */
  canva_design_id: string | null;
  canva_edit_url: string | null;
  canva_asset_id: string | null;
  canva_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the entry screen collects to open a project. */
export interface NewStudioProject {
  title: string;
  product: string;
  platforms: string[];
  ad_type: string;
  campaign_tag: string;
}

/** Fields a Save draft writes back. */
export interface StudioProjectPatch {
  title?: string;
  current_step?: number;
  state?: StudioStateBlob;
  slides?: StudioSlide[];
  status?: StudioProject["status"];
}

const from = () => supabase.from(TABLE);

/** Undo the jsonb-to-Json widening in exactly one place. */
function toProject(row: {
  state: Json; slides: Json; status: string; [k: string]: unknown;
}): StudioProject {
  return {
    ...row,
    state: (row.state ?? {}) as StudioStateBlob,
    slides: (row.slides ?? []) as unknown as StudioSlide[],
    status: row.status as StudioProject["status"],
  } as StudioProject;
}

export async function listProjects(): Promise<StudioProject[]> {
  const { data, error } = await from()
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(toProject);
}

export async function getProject(id: string): Promise<StudioProject> {
  const { data, error } = await from().select("*").eq("id", id).single();
  if (error) throw error;
  return toProject(data);
}

export async function createProject(input: NewStudioProject): Promise<StudioProject> {
  // created_by is required by the insert policy (created_by = auth.uid()), so
  // read the session rather than relying on a column default.
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in.");

  const { data, error } = await from()
    .insert({
      created_by: uid,
      title: input.title.trim() || "Untitled campaign",
      product: input.product,
      platforms: input.platforms,
      ad_type: input.ad_type,
      campaign_tag: input.campaign_tag,
      current_step: 0,
      status: "draft",
      state: {},
      // Every ad opens with one slide. Carousel adds more once its UI lands;
      // the shape does not change.
      slides: [{ id: crypto.randomUUID() }],
    })
    .select("*")
    .single();
  if (error) throw error;
  return toProject(data);
}

export async function saveProject(
  id: string,
  patch: StudioProjectPatch,
): Promise<StudioProject> {
  const { data, error } = await from()
    // state/slides are typed shapes here and jsonb in Postgres. The generated
    // Json type demands an index signature that a precise interface will never
    // have, so the widening has to go through unknown.
    .update(patch as unknown as { state?: Json; slides?: Json })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return toProject(data);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await from().delete().eq("id", id);
  if (error) throw error;
}
