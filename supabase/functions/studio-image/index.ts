// studio-image — AI image generation and editing for the founder-only /studio.
//
// Modes (POST body { mode, ... }):
//   status   → is an image model configured
//   generate → make a new image from a text prompt
//   edit     → apply an edit to an image already in the studio-assets bucket
//
// PROVIDER NOTE: the phased build prompt specified "Kimi swarm" for image
// generation. Moonshot/Kimi exposes text and VISION (image understanding) only;
// it has no image-generation endpoint, so that decision was not buildable as
// written. Gemini was chosen instead (founder's call) because it does both
// generate-from-scratch and edit-an-upload, which the spec requires.
//
// The brand lock is assembled HERE and never sent to the client, so the prompt
// that constrains palette, iconography, and subject matter cannot be inspected
// or weakened from the browser. The client supplies only the founder's own
// words and a creative-range setting.
//
// Gate: verify_jwt=true (gateway) + the founder email check below.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "../_shared/sentry.ts";
import { enforceRateLimit } from "../_shared/studio-rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Overridable without a redeploy: image model names move faster than this code.
const PRIMARY_MODEL = Deno.env.get("GEMINI_IMAGE_MODEL") ?? "gemini-2.5-flash-image";
const FALLBACK_MODEL = Deno.env.get("GEMINI_IMAGE_MODEL_FALLBACK") ?? "gemini-2.0-flash-preview-image-generation";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const FOUNDER_EMAIL = "hello@edeninstitute.health";
const BUCKET = "studio-assets";

// Per-UTC-day ceiling on paid image generations/edits. Fail-open; overridable.
const DAILY_LIMIT = Number(Deno.env.get("STUDIO_IMAGE_DAILY_LIMIT") ?? "150");

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

// ── Brand lock ──────────────────────────────────────────────────────────────
//
// Palette values are the authoritative ones from eden-ops
// Eden_Brand_Voice_Guide.docx §4.1, the same values seeded into
// studio_brand_tokens. The build prompt quoted different hexes; they are wrong
// and deliberately not used here.

const PALETTE =
  "Deep Forest Green #2B3A1E, Golden Amber #C5A44E, Warm Linen #F5EDD6, " +
  "Near Black #1E1E14, Dark Walnut #5C4A28, Olive Green #6B7F3A, Sage Green #8A9A5B";

const BRAND_LOCK = `You are producing imagery for The Eden Institute, a biblical herbalism school, and Eden's Table, its K-5 homeschool herbalism curriculum.

PALETTE: work within ${PALETTE}. Natural light, warm and earthy, never neon or high-saturation digital colour.

MATERIAL AND MOOD: linen, parchment, aged wood, brass, glass apothecary jars, dried herb bundles, botanical illustration. Vintage apothecary and materia medica feeling. Quiet, reverent, unhurried. Photographic realism or engraved botanical illustration, not 3D render and not cartoon.

HARD CONSTRAINTS:
- No Eastern religious iconography of any kind: no mandalas, chakras, lotus symbolism, Buddha or deity figures, yin-yang, om, incense-and-crystal styling.
- No recognisable real people, and no faces that read as a specific identifiable individual. Hands, backs, silhouettes, and partial figures are fine and preferred.
- No crystals, tarot, astrology, moon-phase mysticism, or new-age symbolism.
- Faith-integrated but never kitsch: no glowing crosses, no rays of light from heaven, no praying-hands clip art, no scripture text rendered inside the image.
- No text, lettering, watermarks, or logos in the image. Copy is composited later.
- Nothing clinical or medical: no pills, syringes, lab coats, or supplement bottles with labels.`;

const RANGE_RULES: Record<string, string> = {
  strict:
    "CREATIVE RANGE: STRICT. Stay tightly inside the palette and material list. Compose simply and conventionally: one clear subject, uncluttered background, centred or rule-of-thirds. Do not introduce objects, settings, or styling that were not asked for.",
  moderate:
    "CREATIVE RANGE: MODERATE. Stay inside the palette and mood, but you may add supporting detail, props, and depth that serve the subject. Reasonable compositional interpretation is welcome.",
  loose:
    "CREATIVE RANGE: LOOSE. Treat the palette and mood as direction rather than constraint, and interpret the brief boldly in composition, angle, and styling. The hard constraints above still apply without exception.",
};

function systemPrompt(range: string): string {
  return BRAND_LOCK + "\n\n" + (RANGE_RULES[range] ?? RANGE_RULES.moderate);
}

// ── Gemini ──────────────────────────────────────────────────────────────────

interface InlineImage { mimeType: string; data: string }

async function callGemini(
  model: string, parts: unknown[],
): Promise<{ image: InlineImage | null; text: string }> {
  // The key rides in a header, never the URL. A network-level fetch failure
  // throws a TypeError whose message contains the request URL; keeping the key
  // out of the URL keeps it out of that message (and out of any error body the
  // handler returns, plus Google's own request logs).
  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`gemini ${model} ${res.status}: ${text.slice(0, 300)}`);
  const body = JSON.parse(text);
  const out = body.candidates?.[0]?.content?.parts ?? [];
  let image: InlineImage | null = null;
  let note = "";
  for (const p of out) {
    if (p.inlineData?.data && !image) {
      image = { mimeType: p.inlineData.mimeType ?? "image/png", data: p.inlineData.data };
    } else if (typeof p.text === "string") {
      note += p.text;
    }
  }
  return { image, text: note };
}

/** Model names move; a 404 on the primary is a naming problem, not a real
 *  failure, so fall back once before giving up. */
async function generateImage(parts: unknown[]): Promise<{ image: InlineImage | null; text: string; model: string }> {
  try {
    const r = await callGemini(PRIMARY_MODEL, parts);
    return { ...r, model: PRIMARY_MODEL };
  } catch (err) {
    if (!String(err).includes("404")) throw err;
    const r = await callGemini(FALLBACK_MODEL, parts);
    return { ...r, model: FALLBACK_MODEL };
  }
}

// ── Persistence ─────────────────────────────────────────────────────────────

async function storeImage(
  userId: string, img: InlineImage, prompt: string, campaignTag: string,
  projectId: string | null,
): Promise<{ assetId: string; url: string | null; storagePath: string }> {
  const db = admin();
  const bytes = Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0));
  const ext = img.mimeType.includes("jpeg") ? "jpg" : "png";
  const path = `${Date.now()}-ai-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: img.mimeType });
  if (up.error) throw up.error;

  const { data, error } = await db.from("studio_assets").insert({
    created_by: userId,
    storage_path: path,
    filename: `ai-${prompt.slice(0, 40).replace(/[^\w -]+/g, "").trim() || "generated"}.${ext}`,
    mime_type: img.mimeType,
    kind: "image",
    campaign_tag: campaignTag,
    project_id: projectId,
    size_bytes: bytes.byteLength,
    source: "ai_generated",
    ai_prompt: prompt.slice(0, 2000),
  }).select("id").single();
  if (error) {
    // Do not leave an untracked file behind if the metadata write fails.
    await db.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }

  const signed = await db.storage.from(BUCKET).createSignedUrl(path, 3600);
  return { assetId: data.id, url: signed.data?.signedUrl ?? null, storagePath: path };
}

// ── Entry ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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
      if (!GEMINI_API_KEY) return json({ configured: false, model: PRIMARY_MODEL });
      // Confirm the configured model actually exists rather than discovering it
      // on the founder's first generation. Image model names change often, so
      // when the configured one is missing, report what IS available.
      let available: string[] = [];
      let ok = true;
      try {
        const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
          headers: { "x-goog-api-key": GEMINI_API_KEY! },
        });
        if (res.ok) {
          const body = await res.json();
          available = (body.models ?? [])
            .map((m: { name?: string }) => String(m.name ?? "").replace(/^models\//, ""))
            .filter((n: string) => /image/i.test(n));
          ok = available.includes(PRIMARY_MODEL);
        }
      } catch (_e) {
        // A failed probe is not a failed integration; fall through as ok.
      }
      return json({
        configured: true,
        model: PRIMARY_MODEL,
        modelAvailable: ok,
        imageModels: available.slice(0, 12),
      });
    }
    if (!GEMINI_API_KEY) return json({ error: "no_provider" }, 503);

    const prompt = String(body.prompt ?? "").trim().slice(0, 2000);
    if (!prompt) return json({ error: "empty_prompt" }, 400);
    const range = String(body.range ?? "moderate");
    // Clamped like every other caller-supplied string: it lands in a DB column.
    const campaignTag = String(body.campaignTag ?? "general").slice(0, 100);
    const projectId = body.projectId ? String(body.projectId).slice(0, 100) : null;

    // generate and edit both spend on a Gemini call. Meter them (fail-open).
    const rl = await enforceRateLimit(userClient, "studio-image", DAILY_LIMIT);
    if (!rl.allowed) {
      return json({
        error: "rate_limited",
        detail: `Daily image limit (${rl.limit}) reached. It resets at UTC midnight.`,
      }, 429);
    }

    if (mode === "generate") {
      const parts = [{ text: systemPrompt(range) + "\n\nBRIEF: " + prompt }];
      const r = await generateImage(parts);
      if (!r.image) {
        return json({ error: "no_image", detail: r.text.slice(0, 300) }, 502);
      }
      const stored = await storeImage(user.id, r.image, prompt, campaignTag, projectId);
      return json({ ...stored, model: r.model, note: r.text.slice(0, 300) });
    }

    if (mode === "edit") {
      const storagePath = String(body.storagePath ?? "");
      if (!storagePath) return json({ error: "bad_request" }, 400);

      // Read the source image server-side. The client only names an asset it
      // can already see; it never has to ship image bytes back up.
      const dl = await admin().storage.from(BUCKET).download(storagePath);
      if (dl.error || !dl.data) return json({ error: "source_not_found" }, 404);
      const buf = new Uint8Array(await dl.data.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
      const b64 = btoa(binary);

      const parts = [
        { text: systemPrompt(range) + "\n\nEDIT THIS IMAGE. Keep its subject and composition unless the instruction says otherwise.\n\nINSTRUCTION: " + prompt },
        { inlineData: { mimeType: dl.data.type || "image/png", data: b64 } },
      ];
      const r = await generateImage(parts);
      if (!r.image) {
        return json({ error: "no_image", detail: r.text.slice(0, 300) }, 502);
      }
      const stored = await storeImage(
        user.id, r.image, `edit: ${prompt}`, campaignTag, projectId,
      );
      return json({ ...stored, model: r.model, note: r.text.slice(0, 300) });
    }

    return json({ error: "bad_mode" }, 400);
  } catch (err) {
    console.error("studio-image error:", err);
    await captureException(err, { function: "studio-image" });
    return json({ error: "server_error", detail: String(err).slice(0, 400) }, 500);
  }
});
