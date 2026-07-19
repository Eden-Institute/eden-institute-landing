// Drafting copy with the AI engine.
//
// The founder's working model matters more than the mechanics here: she does
// not want the AI to author ads for her approval. She writes and directs, and
// the AI acts as a conversion editor on her words. So the two editing actions
// (sharpen, diagnose) are first-class, and generation is offered alongside the
// already-approved copy bank rather than in place of it.
//
// The hard rule the edge function enforces, restated because it is the reason
// the brief looks the way it does: the model may only assert what is in
// `facts`. It may restructure her words, never introduce a price, date,
// guarantee or attribute that was not already there.

import { ANGLES, AUDIENCES, FORMATS, OBJECTIVES, PRODUCTS } from "./studio-banks";
import { destinationUrl } from "./flow-export";
import type { FlowAnswers } from "./flow-graph";

export type AiInvoke = (body: unknown) => Promise<unknown>;

export interface AiDraft {
  primary: string;
  headline?: string;
  description?: string;
  /** What the editor changed, so a rewrite is reviewable rather than a slot machine. */
  changes?: string[];
  approach?: string;
  model?: string;
  score?: number;
  notes?: string;
}

export interface AiDiagnosis {
  /** 0-10 from the conversion editor, when it gave one. */
  score?: number | null;
  issues?: Array<{ area?: string; severity?: string; note?: string }>;
  strengths?: string[];
}

/** The campaign brief, in the shape the edge function already expects. */
export function buildBrief(a: FlowAnswers) {
  const product = PRODUCTS[a.product ?? ""];
  const angle = ANGLES[a.angle ?? ""];
  const audience = AUDIENCES[a.audience ?? ""];
  return {
    product: product?.name ?? "",
    // The ONLY claims the model is permitted to make.
    facts: product?.facts ?? "",
    angle: angle?.name ?? a.angle ?? "",
    angleEssence: angle?.visual ?? "",
    audience: audience?.name ?? "",
    audienceDesc: String(audience?.note ?? "").replace(/<[^>]+>/g, ""),
    objective: OBJECTIVES[a.objective ?? ""]?.name ?? "",
    format: FORMATS[a.adType ?? ""]?.name ?? "",
    cta: product?.ctas?.[a.objective ?? ""] ?? "",
    url: destinationUrl(a),
    // Empty string when unset, so the function can treat it as absent. Her own
    // direction outranks the preset angle when it is present.
    direction: (a.direction ?? "").trim(),
  };
}

/** Plain language for what came back, so a failure is actionable. */
export function explainAiError(err: unknown): string {
  const e = err as { code?: string; status?: number; message?: string; detail?: unknown };
  const detail = typeof e?.detail === "string" ? ` ${e.detail}` : "";
  switch (e?.code) {
    // studio-generate says no_providers; studio-image says no_provider.
    case "no_providers":
    case "no_provider":
      return "No AI model is set up yet, so drafting is unavailable. The approved "
        + "copy below still works.";
    case "rate_limited":
      return "The daily limit for AI drafting has been reached. It resets tomorrow, "
        + "and the approved copy below still works.";
    case "unauthorized":
      return "The AI key was refused. The approved copy below still works.";
    case "timeout":
      return "The model took too long. Try again, or use the approved copy below.";
    default:
      break;
  }
  if (e?.status === 429) return "Too many requests just now. Give it a minute.";
  if (e?.status === 401 || e?.status === 403) {
    return "That request was refused. The approved copy below still works.";
  }
  return `Drafting failed.${detail || " The approved copy below still works."}`;
}

export interface AiAvailability {
  ready: boolean;
  /** Why not, when it is not. */
  reason?: string;
  models?: string[];
}

export async function checkAi(invoke: AiInvoke | undefined): Promise<AiAvailability> {
  if (!invoke) return { ready: false, reason: "No AI connection in this session." };
  try {
    // studio-generate's status mode answers { providers: [{ id, label, model }] }.
    const r = (await invoke({ mode: "status" })) as {
      providers?: Array<{ label?: string }>; error?: string;
    };
    const models = Array.isArray(r?.providers)
      ? r.providers.map((p) => String(p?.label ?? "")).filter(Boolean)
      : [];
    if (!models.length) {
      return { ready: false, reason: r?.error ?? "No AI model is configured yet." };
    }
    return { ready: true, models };
  } catch (err) {
    return { ready: false, reason: explainAiError(err) };
  }
}

function toDrafts(payload: unknown): AiDraft[] {
  const list = (payload as { drafts?: unknown })?.drafts;
  if (!Array.isArray(list)) return [];
  return list
    .map((d) => d as Record<string, unknown>)
    .filter((d) => typeof d?.primary === "string" && (d.primary as string).trim())
    .map((d) => ({
      primary: String(d.primary),
      headline: typeof d.headline === "string" ? d.headline : undefined,
      description: typeof d.description === "string" ? d.description : undefined,
      changes: Array.isArray(d.changes) ? (d.changes as string[]) : undefined,
      approach: typeof d.approach === "string" ? d.approach : undefined,
      model: typeof d.model === "string" ? d.model : undefined,
      score: typeof d.score === "number" ? d.score : undefined,
      notes: typeof d.notes === "string" ? d.notes : undefined,
    }));
}

/** Three fresh drafts from the brief. */
export async function generateDrafts(
  invoke: AiInvoke, a: FlowAnswers,
): Promise<{ drafts: AiDraft[]; note: string | null }> {
  const r = await invoke({ mode: "generate", brief: buildBrief(a) });
  const drafts = toDrafts(r).slice(0, 3);
  const failures = (r as { errors?: unknown[] })?.errors;
  const note = Array.isArray(failures) && failures.length
    ? `${failures.length} model call${failures.length > 1 ? "s" : ""} failed, `
      + "so there are fewer drafts than usual."
    : null;
  return { drafts, note };
}

/** The edit modes want her whole draft, not just the primary text. */
function draftPayload(a: FlowAnswers, primary: string) {
  return {
    primary,
    headline: a.own?.headline ?? "",
    description: a.own?.description ?? "",
  };
}

/**
 * Her words, edited. Sharpen rewrites for conversion; variations offers
 * alternatives. Neither may introduce a claim that was not already there.
 */
export async function editDraft(
  invoke: AiInvoke, a: FlowAnswers, draft: string,
  action: "sharpen" | "variations", note = "",
): Promise<AiDraft[]> {
  const r = await invoke({
    mode: "edit", action, draft: draftPayload(a, draft), brief: buildBrief(a), note,
  });
  return toDrafts(r);
}

/** Read the draft and report, without rewriting anything. */
export async function diagnoseDraft(
  invoke: AiInvoke, a: FlowAnswers, draft: string,
): Promise<AiDiagnosis> {
  const r = (await invoke({
    mode: "edit", action: "diagnose", draft: draftPayload(a, draft),
    brief: buildBrief(a), note: "",
  })) as AiDiagnosis;
  return {
    score: typeof r?.score === "number" ? r.score : null,
    issues: Array.isArray(r?.issues) ? r.issues : [],
    strengths: Array.isArray(r?.strengths) ? r.strengths : [],
  };
}

/** The approved copy bank, which needs no model and no waiting. Angle-matched
 *  primaries first, then any audience-tuned ones from the approved pack. */
export function bankDrafts(a: FlowAnswers): string[] {
  const product = PRODUCTS[a.product ?? ""];
  const bank = [
    ...(product?.primaries?.[a.angle ?? ""] ?? []),
    ...(product?.audiencePrimaries?.[a.audience ?? ""] ?? []),
  ];
  if (bank.length) return bank;
  return [0, 1, 2].map((i) => [
    product?.headlines?.[i % (product?.headlines?.length || 1)],
    product?.facts,
    product?.descs?.[i % (product?.descs?.length || 1)],
  ].filter(Boolean).join("\n\n"));
}
