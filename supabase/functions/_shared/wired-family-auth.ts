// supabase/functions/_shared/wired-family-auth.ts
// Shared front door for the W9 family endpoints (wired-teen-link, wired-observers): dark gate, JSON body,
// the family's results token, and the child checked to belong to that family. Never another family's data.

import { type Db, pg } from "./wired-submit-flow.ts";
import { verifyWiredToken } from "./wired-token.ts";
import { wiredJson } from "./wired-gate.ts";
import { wiredTesterGate } from "./wired-pilot-pass.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FamilyChild {
  db: Db;
  body: Record<string, unknown>;
  familyId: string;
  child: { id: string; nickname: string; grade: number; unlocked_via: string | null };
  family: { email: string; first_name: string | null };
}

export async function familyChildRequest(req: Request, fn: string): Promise<FamilyChild | Response> {
  const gate = await wiredTesterGate(req);
  if (gate) return gate;
  if (req.method !== "POST") return wiredJson(405, { error: "method_not_allowed" });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return wiredJson(400, { error: "body must be JSON" });
  }
  let grant;
  try {
    grant = await verifyWiredToken(body?.token, "results");
  } catch (err) {
    console.error(`${fn}: token secret problem:`, err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: "server_misconfigured" });
  }
  if (!grant) return wiredJson(401, { error: "invalid_or_expired_link" });
  if (typeof body.child_id !== "string" || !UUID_RE.test(body.child_id)) return wiredJson(400, { error: "child_id is required" });
  const db: Db = { url: Deno.env.get("SUPABASE_URL") ?? "", key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" };
  const fam = (await pg<{ email: string; first_name: string | null }[]>(db, `wired_families?id=eq.${grant.familyId}&select=email,first_name&limit=1`))?.[0];
  if (!fam) return wiredJson(404, { error: "not_found" });
  const child = (await pg<FamilyChild["child"][]>(db,
    `wired_children?id=eq.${body.child_id}&family_id=eq.${grant.familyId}&removed_at=is.null&select=id,nickname,grade,unlocked_via&limit=1`))?.[0];
  if (!child) return wiredJson(404, { error: "unknown_child" });
  return { db, body, familyId: grant.familyId, child, family: fam };
}
