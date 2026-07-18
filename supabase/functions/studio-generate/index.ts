// studio-generate — the AI engine behind the founder-only /studio ad workroom.
//
// Modes (POST body { mode, ... }):
//   status   → which model providers are configured (names only, no cost)
//   generate → fan the campaign brief out to EVERY configured provider in
//              parallel, then run a judge pass that scores all candidates
//              against the Eden voice rubric + Meta ad policy, and return
//              the ranked drafts with model attribution and judge notes
//   remix    → rewrite one draft under a founder-supplied direction
//
// Gate: verify_jwt=true (gateway) + founder email check below. This EF is the
// only place provider API keys live (ANTHROPIC_API_KEY, MOONSHOT_API_KEY,
// OPENAI_COMPAT_API_KEY); the browser never sees them and non-founder JWTs
// get 403 before any model is called. Costs are bounded per request: one
// call per provider plus one judge call, capped max_tokens throughout.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

// ── Providers ────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  label: string;
  kind: "anthropic" | "openai";
  key: string;
  base?: string;
  model: string;
}

function providers(): Provider[] {
  const list: Provider[] = [];
  const ant = Deno.env.get("ANTHROPIC_API_KEY");
  if (ant) {
    list.push({
      id: "claude", label: "Claude", kind: "anthropic", key: ant,
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5",
    });
  }
  const kimi = Deno.env.get("MOONSHOT_API_KEY");
  if (kimi) {
    list.push({
      id: "kimi", label: "Kimi", kind: "openai", key: kimi,
      base: Deno.env.get("MOONSHOT_BASE_URL") ?? "https://api.moonshot.ai/v1",
      model: Deno.env.get("MOONSHOT_MODEL") ?? "kimi-k2-0905-preview",
    });
  }
  const extra = Deno.env.get("OPENAI_COMPAT_API_KEY");
  if (extra) {
    list.push({
      id: "extra",
      label: Deno.env.get("OPENAI_COMPAT_LABEL") ?? "Extra model",
      kind: "openai", key: extra,
      base: Deno.env.get("OPENAI_COMPAT_BASE_URL") ?? "https://api.openai.com/v1",
      model: Deno.env.get("OPENAI_COMPAT_MODEL") ?? "gpt-4o",
    });
  }
  return list;
}

async function callModel(
  p: Provider, system: string, user: string, maxTokens: number,
): Promise<string> {
  const signal = AbortSignal.timeout(60_000);
  if (p.kind === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "x-api-key": p.key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: p.model,
        max_tokens: maxTokens,
        // Sonnet 5 runs adaptive thinking by default and max_tokens caps
        // thinking + text COMBINED; disable it so the whole budget is JSON.
        thinking: { type: "disabled" },
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`${p.label} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
  }
  const res = await fetch(`${p.base}/chat/completions`, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: p.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${p.label} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Model output arrives as prose-wrapped JSON more often than clean JSON;
// take the outermost object literal and parse that.
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in model output");
  return JSON.parse(text.slice(start, end + 1));
}

// ── Eden voice constitution (system prompt) ─────────────────────────────────

const EDEN_VOICE = `You write Facebook/Instagram ads for The Eden Institute (edeninstitute.health), the tiered biblical herbalism school, and for Eden's Table, its K-5 homeschool herbalism curriculum. Founder: Camila Johnson. Tagline: "Back to Eden. Back to Truth."

VOICE: Warm. Grounded. Precise. Reverent. Narrative. Quiet confidence, never hype. Speak to a capable adult steward, never a passive consumer. Scripture (NASB) is foundation, not decoration; weave it naturally or leave it out.

VOCABULARY. Always prefer: stewardship, terrain, constitution, energetics, original medicine, discernment, body pattern. Never use: detox, vibes, manifest, self-care, heal yourself, universe (as agent), alternative medicine, boost your immune system, root cause, ancient wisdom (unattributed), chakra, chi, prana, dosha, energy healing, body type.

HARD RULES:
- No em dashes anywhere. Use commas and periods.
- We educate. Never diagnose, prescribe, treat, or promise health outcomes.
- Meta policy: never imply the reader has a condition ("your anxiety", "do you suffer"), no cure/treat/guarantee language, no before/after claims.
- Use ONLY the facts supplied in the brief. Never invent prices, dates, statistics, approvals, or testimonials.
- At most one 🌿 emoji per ad, or none. Never multiple exclamation marks.
- Primary text: front-load the hook (first 125 characters must stand alone), then blank line, body, blank line, offer/close. 350-650 characters total.
- Headline: 40 characters or fewer. Description: 30 characters or fewer.

OUTPUT: Respond with a single JSON object and nothing else.`;

const JUDGE_RUBRIC = `You are the brand guardian and Meta ads policy reviewer for The Eden Institute. Score each candidate ad 0-10 overall, weighing: hook strength in the first 125 characters (does it stop the scroll for THIS audience), Eden voice fidelity (warm, grounded, precise, reverent; no banned vocabulary; no em dashes), Meta policy safety (no personal health attributes, no cure/treat/guarantee), factual discipline (only claims present in the brief), and craft (specific beats generic). Be adversarial: a candidate that invents a fact or risks Meta disapproval scores 3 or lower. Respond with a single JSON object and nothing else.`;

// ── Brief formatting ────────────────────────────────────────────────────────

interface Brief {
  product?: string;
  facts?: string;
  angle?: string;
  angleEssence?: string;
  audience?: string;
  audienceDesc?: string;
  objective?: string;
  format?: string;
  cta?: string;
  url?: string;
  /** The founder's own words for where the campaign should go. When present it
   *  outranks the preset angle, which is a fixed list she should not be boxed
   *  into. Optional and backward compatible: older clients simply omit it. */
  direction?: string;
}

// Length-clamp every caller-supplied string before it reaches a model call:
// the caller is founder-only, but a compromised session must not become a
// token-cost amplifier.
function clamp(s: unknown, n: number): string {
  return typeof s === "string" ? s.slice(0, n) : "";
}

function briefBlock(b: Brief): string {
  const direction = clamp(b.direction, 1200).trim();
  return [
    "CAMPAIGN BRIEF",
    "Product: " + clamp(b.product, 200),
    "Facts (the ONLY permitted claims): " + clamp(b.facts, 1200),
    // Placed above Angle, and named as outranking it, so the model does not
    // average the founder's instruction together with a preset it contradicts.
    ...(direction
      ? ["FOUNDER'S DIRECTION (highest priority, outranks the Angle below; if the two conflict, follow this): " + direction]
      : []),
    "Angle: " + clamp(b.angle, 200) + (b.angleEssence ? " (" + clamp(b.angleEssence, 400) + ")" : ""),
    "Audience: " + clamp(b.audience, 200) + (b.audienceDesc ? " (" + clamp(b.audienceDesc, 500) + ")" : ""),
    "Objective: " + clamp(b.objective, 60) + " · Placement: " + clamp(b.format, 60),
    "Call to action button: " + (clamp(b.cta, 40) || "Learn More") + " · Destination: " + clamp(b.url, 300),
  ].join("\n");
}

interface Draft {
  primary: string;
  headline: string;
  description: string;
  model?: string;
  score?: number;
  notes?: string;
  flags?: string[];
}

// Server-side lint, independent of any model's self-report.
const LINT: Array<[RegExp, string]> = [
  [/—/, "em dash"],
  [/\bdetox|\bvibes?\b|\bmanifest|self[- ]care|heal yourself|\buniverse\b/i, "banned vocabulary"],
  [/\b(chakra|chi|prana|dosha)\b|energy healing|alternative medicine|root cause|ancient wisdom/i, "banned vocabulary"],
  [/boost (your )?immune/i, "banned vocabulary"],
  [/\bcure|\bguarantee|clinically proven|fda[- ]?approved/i, "Meta policy risk"],
  [/\b(do you (have|suffer|struggle)|your (anxiety|depression|adhd|eczema|illness|condition))\b/i, "personal health attribute"],
  [/!{2,}/, "hype punctuation"],
];

function lint(d: Draft): string[] {
  const all = [d.primary, d.headline, d.description].join("\n");
  const flags: string[] = [];
  for (const [re, label] of LINT) if (re.test(all)) flags.push(label);
  if (d.headline.length > 40) flags.push("headline over 40 chars");
  if (d.description.length > 30) flags.push("description over 30 chars");
  return flags;
}

// ── Modes ───────────────────────────────────────────────────────────────────

async function generate(brief: Brief): Promise<Response> {
  const provs = providers();
  if (!provs.length) return json({ error: "no_providers" }, 503);

  const userMsg = briefBlock(brief) +
    '\n\nWrite 3 distinct ad drafts for this brief, each taking a different hook. Return JSON: {"drafts":[{"primary":"...","headline":"...","description":"..."}]}';

  const settled = await Promise.allSettled(
    provs.map((p) => callModel(p, EDEN_VOICE, userMsg, 3500).then((t) => ({ p, t }))),
  );
  const candidates: Draft[] = [];
  const errors: string[] = [];
  for (const s of settled) {
    if (s.status === "rejected") { errors.push(String(s.reason).slice(0, 200)); continue; }
    try {
      const parsed = extractJson(s.value.t) as { drafts?: Draft[] };
      for (const d of parsed.drafts ?? []) {
        if (d && typeof d.primary === "string" && typeof d.headline === "string") {
          candidates.push({
            primary: d.primary,
            headline: d.headline,
            description: typeof d.description === "string" ? d.description : "",
            model: s.value.p.label,
          });
        }
      }
    } catch (e) {
      errors.push(`${s.value.p.label} returned unparseable output`);
    }
  }
  if (!candidates.length) return json({ error: "all_models_failed", detail: errors }, 502);

  // Judge pass: Claude judges when available (strongest rubric adherence),
  // otherwise the first configured provider judges.
  const judge = provs.find((p) => p.kind === "anthropic") ?? provs[0];
  let ranked = candidates;
  let judgeLabel = "none (single pass)";
  try {
    const judgeMsg = briefBlock(brief) +
      "\n\nCANDIDATES:\n" +
      JSON.stringify(candidates.map((c, i) => ({ index: i, primary: c.primary, headline: c.headline, description: c.description }))) +
      '\n\nScore every candidate. Return JSON: {"scores":[{"index":0,"score":8.5,"notes":"one sentence"}]}';
    const out = extractJson(await callModel(judge, JUDGE_RUBRIC, judgeMsg, 2500)) as {
      scores?: Array<{ index: number; score: number; notes: string }>;
    };
    for (const s of out.scores ?? []) {
      const c = candidates[s.index];
      if (c) { c.score = s.score; c.notes = String(s.notes ?? "").slice(0, 300); }
    }
    ranked = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    judgeLabel = judge.label;
  } catch (_e) {
    // Judge failure is non-fatal: return unranked candidates.
  }
  for (const c of ranked) c.flags = lint(c);

  return json({
    drafts: ranked,
    judge: judgeLabel,
    providers: provs.map((p) => p.label),
    errors,
  });
}

async function remix(brief: Brief, draft: Draft, direction: string): Promise<Response> {
  const provs = providers();
  if (!provs.length) return json({ error: "no_providers" }, 503);
  const p = provs.find((x) => x.kind === "anthropic") ?? provs[0];
  const userMsg = briefBlock(brief) +
    "\n\nCURRENT DRAFT:\n" + JSON.stringify({
      primary: clamp(draft.primary, 2000),
      headline: clamp(draft.headline, 200),
      description: clamp(draft.description, 200),
    }) +
    "\n\nFOUNDER DIRECTION: " + direction.slice(0, 500) +
    '\n\nRewrite the draft under that direction, keeping every hard rule. Return JSON: {"draft":{"primary":"...","headline":"...","description":"..."}}';
  const out = extractJson(await callModel(p, EDEN_VOICE, userMsg, 1600)) as { draft?: Draft };
  if (!out.draft || typeof out.draft.primary !== "string") return json({ error: "unparseable" }, 502);
  const d: Draft = {
    primary: out.draft.primary,
    headline: String(out.draft.headline ?? draft.headline),
    description: String(out.draft.description ?? draft.description),
    model: p.label,
  };
  d.flags = lint(d);
  return json({ draft: d });
}

// ── Edit mode: the founder writes, the model edits ──────────────────────────
//
// The generate path treats the model as the author and Camila as the approver.
// This path inverts that: she writes, and the model applies conversion craft to
// HER words. It exists because the author-first flow kept producing copy that
// was on-voice but off-strategy, and because she is the only one who knows what
// is true about the product.
//
// The load-bearing constraint is the no-new-claims rule. An editor that quietly
// upgrades "covers several subjects" into "covers every subject" would put an
// unapproved claim into a paid ad, which is both a Meta policy risk and a
// trust problem. Restructuring is allowed. Inventing is not.

const EDITOR_ROLE = `ROLE OVERRIDE: For this task you are NOT the author. You are a direct-response copy editor working for Camila, the founder. She has written the draft below. Your job is to make it convert harder without taking it away from her.

HER DRAFT IS THE SOURCE OF TRUTH for substance, claims, intent, and point of view. You may restructure, reorder, cut, tighten, sharpen the hook, and fix rhythm. You may NOT introduce any fact, price, date, statistic, guarantee, benefit, or product attribute that does not already appear in her draft or in the brief's facts line. If her draft is vague, keep it vague or cut it. Never resolve vagueness by inventing a specific.

Preserve her distinctive phrasings where they are working. If a line is clearly hers in a way that matters, keep it and build around it.

CONVERSION PRIORITIES, in order:
1. The first 125 characters must stop the scroll on their own and make one clear promise.
2. One concrete, specific detail beats three abstract benefits.
3. One idea per ad. Cut the second-best idea rather than crowding.
4. The close must state exactly what happens next, in plain words.
5. Read it aloud in your head: if a sentence needs a second pass to parse, rewrite it.

Every change you make must be explainable in one short clause.`;

interface EditDraft {
  primary?: string;
  headline?: string;
  description?: string;
}

async function editDraft(
  brief: Brief, draft: EditDraft, action: string, note: string,
): Promise<Response> {
  const provs = providers();
  if (!provs.length) return json({ error: "no_providers" }, 503);
  const p = provs.find((x) => x.kind === "anthropic") ?? provs[0];

  const hers = JSON.stringify({
    primary: clamp(draft.primary, 4000),
    headline: clamp(draft.headline, 300),
    description: clamp(draft.description, 300),
  });

  let task: string;
  if (action === "diagnose") {
    task = 'Do NOT rewrite anything. Critique her draft as a conversion specialist would. Be specific and useful, not encouraging. Return JSON: {"score":0-10,"strengths":["..."],"issues":[{"area":"hook|clarity|specificity|proof|cta|voice|policy","severity":"high|medium|low","note":"what is wrong and what would fix it"}]}';
  } else if (action === "variations") {
    task = 'Give THREE variations of her ad. Same substance, same claims, same voice; genuinely different angles of attack (for example: lead with the objection, lead with the concrete detail, lead with the outcome). Return JSON: {"drafts":[{"primary":"...","headline":"...","description":"...","approach":"four words on the angle","changes":["..."]}]}';
  } else {
    task = 'Make ONE sharpened version of her ad. Return JSON: {"draft":{"primary":"...","headline":"...","description":"..."},"changes":["one short clause per meaningful change, max 5"]}';
  }

  const userMsg = briefBlock(brief) +
    "\n\nCAMILA'S DRAFT (the source of truth):\n" + hers +
    (note ? "\n\nHER ADDITIONAL NOTE: " + note.slice(0, 800) : "") +
    "\n\nTASK: " + task;

  const raw = await callModel(p, EDEN_VOICE + "\n\n" + EDITOR_ROLE, userMsg, 2600);
  const out = extractJson(raw) as {
    draft?: EditDraft; drafts?: EditDraft[]; changes?: string[];
    score?: number; issues?: unknown[]; strengths?: string[];
  };

  if (action === "diagnose") {
    if (typeof out.score !== "number" && !Array.isArray(out.issues)) {
      return json({ error: "unparseable" }, 502);
    }
    return json({
      score: out.score ?? null,
      strengths: (out.strengths ?? []).slice(0, 6),
      issues: (out.issues ?? []).slice(0, 8),
      model: p.label,
    });
  }

  // Both rewrite actions return drafts; normalise to a list and lint each one,
  // so founder-written copy gets the same brand/policy check as generated copy.
  const list: EditDraft[] = action === "variations"
    ? (Array.isArray(out.drafts) ? out.drafts.slice(0, 3) : [])
    : (out.draft ? [out.draft] : []);
  if (!list.length || typeof list[0].primary !== "string") {
    return json({ error: "unparseable" }, 502);
  }

  const drafts: Draft[] = list.map((d) => {
    const full: Draft = {
      primary: String(d.primary ?? ""),
      headline: String(d.headline ?? draft.headline ?? ""),
      description: String(d.description ?? draft.description ?? ""),
      model: p.label,
    };
    full.flags = lint(full);
    (full as Draft & { approach?: string; changes?: string[] }).approach =
      typeof (d as { approach?: string }).approach === "string"
        ? (d as { approach: string }).approach : undefined;
    (full as Draft & { changes?: string[] }).changes =
      Array.isArray((d as { changes?: string[] }).changes)
        ? (d as { changes: string[] }).changes.slice(0, 5)
        : (Array.isArray(out.changes) ? out.changes.slice(0, 5) : []);
    return full;
  });

  return json({ drafts, model: p.label });
}

// ── Entry ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);
    if ((user.email ?? "").toLowerCase() !== FOUNDER_EMAIL) {
      return json({ error: "founder_only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "status";

    if (mode === "status") {
      return json({
        providers: providers().map((p) => ({ id: p.id, label: p.label, model: p.model })),
      });
    }
    if (mode === "generate") return await generate(body.brief ?? {});
    if (mode === "edit") {
      const action = String(body.action ?? "sharpen");
      if (!["sharpen", "variations", "diagnose"].includes(action)) {
        return json({ error: "bad_request" }, 400);
      }
      const draft = body.draft as EditDraft | undefined;
      if (!draft || typeof draft.primary !== "string" || !draft.primary.trim()) {
        return json({ error: "empty_draft" }, 400);
      }
      return await editDraft(
        body.brief ?? {}, draft, action, String(body.note ?? ""),
      );
    }
    if (mode === "remix") {
      if (!body.draft || typeof body.direction !== "string") return json({ error: "bad_request" }, 400);
      return await remix(body.brief ?? {}, body.draft, body.direction);
    }
    return json({ error: "unknown_mode" }, 400);
  } catch (e) {
    console.error("studio-generate error:", e);
    return json({ error: "internal", detail: String(e).slice(0, 300) }, 500);
  }
});
