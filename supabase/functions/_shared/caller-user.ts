// supabase/functions/_shared/caller-user.ts
//
// Resolves the signed-in Supabase user behind a request's Authorization
// header, or null. The public anon key is a valid JWT but carries no user, so
// it resolves to null. Never throws.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getCallerUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return null;
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) return null;
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await client.auth.getUser();
    return user ? { id: user.id, email: user.email ?? null } : null;
  } catch {
    return null;
  }
}
