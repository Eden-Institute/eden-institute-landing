// Per-day spend ceiling for the founder-only /studio AI edge functions.
//
// FAILS OPEN by design: if the counter cannot be read or written (RPC not yet
// deployed, transient DB error), the request is allowed. A rate-limit outage
// must never block the founder's legitimate work; the ceiling exists to bound a
// compromised session, not to gate normal use.
//
// The heavy lifting is one atomic round trip to studio_rate_bump(), which
// increments today's counter for the caller + endpoint and returns the new
// count. The caller supplies the limit so the policy lives in the edge function,
// not the database.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateResult {
  allowed: boolean;
  /** The post-increment count for today, or null when the check failed open. */
  count: number | null;
  limit: number;
}

export async function enforceRateLimit(
  client: SupabaseClient,
  endpoint: string,
  limit: number,
): Promise<RateResult> {
  try {
    const { data, error } = await client.rpc("studio_rate_bump", { p_endpoint: endpoint });
    if (error || typeof data !== "number") {
      console.warn(`studio rate-limit check failed open for ${endpoint}:`, error?.message ?? "no count");
      return { allowed: true, count: null, limit };
    }
    return { allowed: data <= limit, count: data, limit };
  } catch (e) {
    console.warn(`studio rate-limit check threw (failing open) for ${endpoint}:`, e);
    return { allowed: true, count: null, limit };
  }
}
