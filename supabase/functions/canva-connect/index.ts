// canva-connect — the Canva Connect round-trip behind the founder-only /studio.
//
// Modes (POST body { mode, ... }):
//   status     → is Canva connected, and when does the token expire
//   auth_url   → build the authorize URL for a client-supplied PKCE challenge
//   exchange   → swap an authorization code for tokens and store them
//   disconnect → forget the stored tokens
//   export     → push a rendered creative to Canva as a new design
//   reimport   → pull the finished design back and overwrite the active asset
//
// Why this is server-side: Canva's token endpoint uses client-secret auth and
// explicitly blocks browser origins via CORS. The secret only ever exists here.
//
// Gate: verify_jwt=true (gateway) + the founder email check below, matching
// studio-generate. Tokens live in studio_canva_tokens, which has RLS enabled
// and zero policies, so only this function's service-role client can read them.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CANVA_CLIENT_ID = Deno.env.get("CANVA_CLIENT_ID") ?? "OC-AZ91xlU40Sh0";
const CANVA_CLIENT_SECRET = Deno.env.get("CANVA_CLIENT_SECRET");

const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const API = "https://api.canva.com/rest/v1";

// Matches the scopes granted in the developer portal. Least privilege: enough
// to upload a creative, make a design from it, and read the result back.
const SCOPES = [
  "asset:read", "asset:write",
  "design:content:read", "design:content:write",
  "design:meta:read",
].join(" ");

const FOUNDER_EMAIL = "hello@edeninstitute.health";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);

// ── Tokens ──────────────────────────────────────────────────────────────────

interface TokenRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
}

function basicAuth(): string {
  return "Basic " + btoa(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`);
}

async function tokenRequest(body: Record<string, string>): Promise<{
  access_token: string; refresh_token: string; expires_in: number; scope?: string;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`canva token ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function storeTokens(
  userId: string,
  t: { access_token: string; refresh_token: string; expires_in: number; scope?: string },
): Promise<void> {
  const expiresAt = new Date(Date.now() + (t.expires_in ?? 14400) * 1000).toISOString();
  const { error } = await admin().from("studio_canva_tokens").upsert({
    user_id: userId,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: expiresAt,
    scope: t.scope ?? null,
  }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Return a usable access token, refreshing when it is close to expiry.
 *  Canva refresh tokens are SINGLE USE, so the new one must be persisted. */
async function accessToken(userId: string): Promise<string | null> {
  const { data, error } = await admin()
    .from("studio_canva_tokens")
    .select("access_token, refresh_token, expires_at, scope")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as TokenRow;
  // 60s of slack so a token cannot expire mid-request.
  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) return row.access_token;

  const fresh = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: row.refresh_token,
  });
  await storeTokens(userId, fresh);
  return fresh.access_token;
}

// ── Canva API helpers ───────────────────────────────────────────────────────

async function canva(
  token: string, path: string, init: RequestInit = {},
): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`canva ${path} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/** Both asset upload and export are asynchronous jobs. */
async function pollJob(
  token: string, path: string, pick: (b: any) => any, tries = 20,
): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const body = await canva(token, path);
    const job = pick(body);
    if (job?.status === "success") return job;
    if (job?.status === "failed") {
      throw new Error(`canva job failed: ${JSON.stringify(job.error ?? {}).slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("canva job timed out");
}

async function uploadAsset(token: string, bytes: Uint8Array, name: string): Promise<string> {
  // name_base64 caps at 50 characters BEFORE encoding.
  const safe = name.slice(0, 50);
  const started = await fetch(`${API}/asset-uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify({ name_base64: btoa(safe) }),
    },
    body: bytes,
  });
  const startedText = await started.text();
  if (!started.ok) {
    throw new Error(`canva asset-uploads ${started.status}: ${startedText.slice(0, 300)}`);
  }
  const job = JSON.parse(startedText).job;
  if (job?.status === "success" && job.asset?.id) return job.asset.id;
  const done = await pollJob(token, `/asset-uploads/${job.id}`, (b) => b.job);
  return done.asset.id;
}

// ── Modes ───────────────────────────────────────────────────────────────────

async function doExport(userId: string, body: any): Promise<Response> {
  const token = await accessToken(userId);
  if (!token) return json({ error: "not_connected" }, 409);

  const { projectId, pngBase64, title, width, height, assetId } = body;
  if (!projectId || !pngBase64) return json({ error: "bad_request" }, 400);

  const bytes = Uint8Array.from(atob(String(pngBase64)), (c) => c.charCodeAt(0));
  const canvaAssetId = await uploadAsset(token, bytes, String(title ?? "Eden ad"));

  const design = await canva(token, "/designs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      design_type: {
        type: "custom",
        // Canva rejects dimensions outside 40..8000 and area over 25e6.
        width: Math.min(Math.max(Number(width) || 1080, 40), 8000),
        height: Math.min(Math.max(Number(height) || 1350, 40), 8000),
      },
      asset_id: canvaAssetId,
      title: String(title ?? "Eden ad"),
    }),
  });

  const d = design.design ?? design;
  const { error } = await admin().from("studio_projects").update({
    canva_design_id: d.id,
    canva_edit_url: d.urls?.edit_url ?? null,
    canva_asset_id: assetId ?? null,
    canva_synced_at: new Date().toISOString(),
  }).eq("id", projectId);
  if (error) throw error;

  return json({ designId: d.id, editUrl: d.urls?.edit_url ?? null });
}

async function doReimport(userId: string, body: any): Promise<Response> {
  const token = await accessToken(userId);
  if (!token) return json({ error: "not_connected" }, 409);

  const { projectId } = body;
  if (!projectId) return json({ error: "bad_request" }, 400);

  const db = admin();
  const { data: proj, error: projErr } = await db
    .from("studio_projects")
    .select("id, canva_design_id, canva_asset_id, campaign_tag, created_by")
    .eq("id", projectId)
    .single();
  if (projErr) throw projErr;
  if (!proj?.canva_design_id) return json({ error: "no_design" }, 409);

  // Export the design as PNG, then poll until the download URLs appear.
  const started = await canva(token, "/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      design_id: proj.canva_design_id,
      format: { type: "png", lossless: true, as_single_image: true },
    }),
  });
  const job = started.job ?? started;
  const done = job.status === "success"
    ? job
    : await pollJob(token, `/exports/${job.id}`, (b) => b.job);

  const url = done.urls?.[0];
  if (!url) return json({ error: "no_export_url" }, 502);

  const fileRes = await fetch(url);
  if (!fileRes.ok) return json({ error: "download_failed" }, 502);
  const blob = new Uint8Array(await fileRes.arrayBuffer());

  const path = `${Date.now()}-canva-${proj.canva_design_id}.png`;
  const up = await db.storage.from("studio-assets").upload(path, blob, {
    contentType: "image/png",
  });
  if (up.error) throw up.error;

  // Overwrite the active version, keeping the superseded bytes recoverable.
  let assetId: string | null = proj.canva_asset_id ?? null;
  if (assetId) {
    const { data: asset } = await db
      .from("studio_assets").select("storage_path").eq("id", assetId).maybeSingle();
    const { data: last } = await db
      .from("studio_asset_versions")
      .select("version_number")
      .eq("asset_id", assetId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    let next = (last?.version_number ?? 0) + 1;
    if (asset?.storage_path) {
      // First round-trip: record the pre-Canva bytes as version 1.
      await db.from("studio_asset_versions").insert({
        asset_id: assetId,
        version_number: next,
        source: last ? "canva" : "native",
        storage_path: asset.storage_path,
      });
      next += 1;
    }
    await db.from("studio_assets").update({ storage_path: path }).eq("id", assetId);
  } else {
    const { data: created, error: insErr } = await db.from("studio_assets").insert({
      created_by: proj.created_by,
      storage_path: path,
      filename: `canva-${proj.canva_design_id}.png`,
      mime_type: "image/png",
      kind: "image",
      // Provenance. This function predates the source column (added in Phase 4)
      // and defaulted to 'upload', so reimported art was indistinguishable from
      // a photograph the founder shot. The gallery badge existed with nothing
      // to show.
      source: "canva",
      campaign_tag: proj.campaign_tag ?? "general",
      project_id: proj.id,
    }).select("id").single();
    if (insErr) throw insErr;
    assetId = created.id;
    await db.from("studio_projects")
      .update({ canva_asset_id: assetId, canva_synced_at: new Date().toISOString() })
      .eq("id", proj.id);
  }

  const signed = await db.storage.from("studio-assets").createSignedUrl(path, 3600);
  return json({
    assetId,
    storagePath: path,
    url: signed.data?.signedUrl ?? null,
  });
}

// ── Entry ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!CANVA_CLIENT_SECRET) return json({ error: "not_configured" }, 503);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);
    if ((user.email ?? "").toLowerCase() !== FOUNDER_EMAIL) {
      return json({ error: "founder_only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "status";

    if (mode === "status") {
      const { data } = await admin()
        .from("studio_canva_tokens")
        .select("expires_at, scope")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({ connected: !!data, expiresAt: data?.expires_at ?? null });
    }

    if (mode === "auth_url") {
      const { codeChallenge, state, redirectUri } = body;
      if (!codeChallenge || !state || !redirectUri) return json({ error: "bad_request" }, 400);
      const u = new URL(AUTHORIZE_URL);
      u.searchParams.set("code_challenge", String(codeChallenge));
      u.searchParams.set("code_challenge_method", "S256");
      u.searchParams.set("response_type", "code");
      u.searchParams.set("client_id", CANVA_CLIENT_ID);
      u.searchParams.set("scope", SCOPES);
      u.searchParams.set("state", String(state));
      u.searchParams.set("redirect_uri", String(redirectUri));
      return json({ url: u.toString() });
    }

    if (mode === "exchange") {
      const { code, codeVerifier, redirectUri } = body;
      if (!code || !codeVerifier || !redirectUri) return json({ error: "bad_request" }, 400);
      const tokens = await tokenRequest({
        grant_type: "authorization_code",
        code: String(code),
        code_verifier: String(codeVerifier),
        redirect_uri: String(redirectUri),
      });
      await storeTokens(user.id, tokens);
      return json({ connected: true });
    }

    if (mode === "disconnect") {
      await admin().from("studio_canva_tokens").delete().eq("user_id", user.id);
      return json({ connected: false });
    }

    if (mode === "export") return await doExport(user.id, body);
    if (mode === "reimport") return await doReimport(user.id, body);

    return json({ error: "bad_mode" }, 400);
  } catch (err) {
    return json({ error: "server_error", detail: String(err).slice(0, 400) }, 500);
  }
});
