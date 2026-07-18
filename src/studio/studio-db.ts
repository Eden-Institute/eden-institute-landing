// Persistence for /studio campaign projects (Ad Studio Phase 1).
//
// TYPING NOTE: src/integrations/supabase/types.ts is generated and currently
// stale (it predates ~20 tables in the live schema, including orders/products
// and this one). Regenerating it here would bury this PR under thousands of
// unrelated lines, so studio_projects is typed by hand at this boundary and the
// untyped client is cast once, in this file only. Every caller below is fully
// type-checked. Regenerating types.ts is worth its own housekeeping PR.

import { supabase } from "@/integrations/supabase/client";
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

// The single cast. See TYPING NOTE above.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = () => (supabase as any).from(TABLE);

export async function listProjects(): Promise<StudioProject[]> {
  const { data, error } = await from()
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as StudioProject[];
}

export async function getProject(id: string): Promise<StudioProject> {
  const { data, error } = await from().select("*").eq("id", id).single();
  if (error) throw error;
  return data as StudioProject;
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
  return data as StudioProject;
}

export async function saveProject(
  id: string,
  patch: StudioProjectPatch,
): Promise<StudioProject> {
  const { data, error } = await from().update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as StudioProject;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await from().delete().eq("id", id);
  if (error) throw error;
}
