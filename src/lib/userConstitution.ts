import { supabase } from "@/integrations/supabase/client";

/**
 * The user-level constitution (quiz result) from profiles.constitution_type.
 *
 * Shared by useEdenPattern and useDiagnosticProfile, which previously carried
 * byte-identical copies of this query. Soft-fails to null on error by design:
 * a transient read failure renders as "no Pattern yet" rather than an error
 * page, which both callers already handle.
 */
export async function readUserLevelConstitution(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("constitution_type")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[userConstitution] readUserLevelConstitution failed", error);
    return null;
  }
  const v = (data as { constitution_type?: string | null } | null)
    ?.constitution_type;
  return typeof v === "string" ? v : null;
}
