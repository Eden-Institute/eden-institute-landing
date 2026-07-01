// supabase/functions/constitution-pdf/index.ts
// Renders the buyer's pattern-specific Constitutional Deep-Dive Guide as a PDF.
//
//   GET ?type=<pattern-slug>   e.g. "frozen-knot" (one of the 8 named patterns)
//
// Also accepts the 4 legacy temperature-by-moisture types (hot-dry, hot-damp,
// cold-dry, cold-damp) which map to a representative pattern, so older callers
// keep working. Returns application/pdf.
//
// Source of truth for the content is the same per-pattern data the live /guide
// page renders (guide-content-<slug>.ts), so the emailed PDF matches the page.
//
// Public EF (verify_jwt=false in config.toml): fetched server-side by the
// stripe-webhook on purchase, and safe to fetch directly.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";
import type { FullGuideContent } from "./guide-types.ts";
import { burningBowstringGuide } from "./guide-content-burning-bowstring.ts";
import { drawnBowstringGuide } from "./guide-content-drawn-bowstring.ts";
import { frozenKnotGuide } from "./guide-content-frozen-knot.ts";
import { openFlameGuide } from "./guide-content-open-flame.ts";
import { overflowingCupGuide } from "./guide-content-overflowing-cup.ts";
import { pressureCookerGuide } from "./guide-content-pressure-cooker.ts";
import { spentCandleGuide } from "./guide-content-spent-candle.ts";
import { stillWaterGuide } from "./guide-content-still-water.ts";
import { isServiceRoleRequest, serviceRoleRequired } from "../_shared/require-service-role.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GUIDES: Record<string, FullGuideContent> = {
  "burning-bowstring": burningBowstringGuide,
  "drawn-bowstring": drawnBowstringGuide,
  "frozen-knot": frozenKnotGuide,
  "open-flame": openFlameGuide,
  "overflowing-cup": overflowingCupGuide,
  "pressure-cooker": pressureCookerGuide,
  "spent-candle": spentCandleGuide,
  "still-water": stillWaterGuide,
};

// Backward compatibility: the 4 legacy temperature-by-moisture types map onto a
// representative pattern (the tension axis isn't expressed in the legacy param).
const LEGACY_TYPE_TO_SLUG: Record<string, string> = {
  "hot-dry": "burning-bowstring",
  "hot-damp": "pressure-cooker",
  "cold-dry": "drawn-bowstring",
  "cold-damp": "frozen-knot",
};

// PDF layout
const PAGE_W = 612, PAGE_H = 792, MARGIN = 58, CW = PAGE_W - MARGIN * 2;
const forest = rgb(0.173,0.243,0.176), gold = rgb(0.773,0.643,0.306), body = rgb(0.24,0.22,0.20), sage = rgb(0.36,0.48,0.36), light = rgb(0.45,0.42,0.40);

function clean(s: unknown): string {
  let out = String(s ?? "");
  out = out.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  out = out.replace(/[–—]/g, "-").replace(/…/g, "...").replace(/•/g, "-");
  out = out.replace(/[^ -~]/g, " ");
  return out;
}

async function renderFullGuide(content: FullGuideContent): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${content.nickname} - Constitutional Deep-Dive Guide`);
  doc.setAuthor("The Eden Institute");
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const newPage = () => { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; };
  const ensure = (h: number) => { if (y - h < MARGIN + 24) newPage(); };

  function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const words = clean(text).split(/\s+/).filter(Boolean);
    const lines: string[] = []; let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }
  function para(text: string, o: { font?: PDFFont; size?: number; color?: any; gap?: number; indent?: number; after?: number } = {}) {
    const font = o.font ?? serif, size = o.size ?? 11, color = o.color ?? body, gap = o.gap ?? 5, indent = o.indent ?? 0;
    for (const ln of wrap(text, font, size, CW - indent)) {
      ensure(size + gap);
      page.drawText(ln, { x: MARGIN + indent, y: y - size, size, font, color });
      y -= size + gap;
    }
    y -= o.after ?? 8;
  }
  function heading(text: string, o: { size?: number; color?: any; font?: PDFFont; before?: number; after?: number } = {}) {
    const size = o.size ?? 15; y -= o.before ?? 10; ensure(size + (o.after ?? 8));
    for (const ln of wrap(text, o.font ?? bold, size, CW)) { page.drawText(ln, { x: MARGIN, y: y - size, size, font: o.font ?? bold, color: o.color ?? forest }); y -= size + 3; }
    y -= o.after ?? 6;
  }
  function chapterLabel(label: string) {
    y -= 16; ensure(20);
    page.drawText(clean(label).toUpperCase(), { x: MARGIN, y: y - 9, size: 9, font: bold, color: gold });
    y -= 17;
  }
  function divider() { ensure(16); page.drawLine({ start: { x: MARGIN, y: y - 4 }, end: { x: PAGE_W - MARGIN, y: y - 4 }, thickness: 0.8, color: gold }); y -= 16; }
  function bullet(text: string) { para("- " + text, { indent: 12, size: 10.5, after: 3 }); }
  const centered = (text: string, size: number, font: PDFFont, color: any, yy: number) => {
    const t = clean(text), w = font.widthOfTextAtSize(t, size);
    page.drawText(t, { x: (PAGE_W - w) / 2, y: yy, size, font, color });
  };

  // Cover
  let cy = PAGE_H - 170;
  centered("THE EDEN INSTITUTE", 12, bold, gold, cy); cy -= 14;
  centered("Back to Eden. Back to Truth.", 10, italic, sage, cy); cy -= 56;
  centered(content.nickname, 30, bold, forest, cy); cy -= 34;
  for (const ln of wrap(content.tagline, italic, 13, CW - 30)) { centered(ln, 13, italic, sage, cy); cy -= 19; }
  cy -= 22;
  page.drawLine({ start: { x: (PAGE_W - 130) / 2, y: cy + 10 }, end: { x: (PAGE_W + 130) / 2, y: cy + 10 }, thickness: 1, color: gold }); cy -= 12;
  centered("Your Constitutional Deep-Dive Guide", 12, bold, gold, cy);
  newPage();

  // Chapter One
  chapterLabel("Chapter One"); heading(content.chapterOne.subtitle);
  for (const p of content.chapterOne.paragraphs) para(p);
  if (content.chapterOne.physicalTendencies?.length) { heading("Physical tendencies", { size: 12, before: 6 }); for (const t of content.chapterOne.physicalTendencies) bullet(t); }
  if (content.chapterOne.emotionalTendencies?.length) { heading("Emotional tendencies", { size: 12, before: 6 }); for (const t of content.chapterOne.emotionalTendencies) bullet(t); }
  if (content.chapterOne.whenImbalanced) { heading("When out of balance", { size: 12, before: 6 }); para(content.chapterOne.whenImbalanced); }

  // Chapter Two
  chapterLabel("Chapter Two"); heading(content.chapterTwo.subtitle);
  for (const p of content.chapterTwo.paragraphs) para(p);

  // Chapter Three
  chapterLabel("Chapter Three"); heading(content.chapterThree.subtitle);
  for (const p of content.chapterThree.paragraphs) para(p);
  if (content.chapterThree.scriptureVerse) { divider(); para(content.chapterThree.scriptureVerse, { font: italic, color: sage, indent: 18, after: 10 }); divider(); }
  if (content.chapterThree.closingParagraph) para(content.chapterThree.closingParagraph);

  // Chapter Four: matched herbs
  chapterLabel("Chapter Four"); heading(content.chapterFour.subtitle);
  if (content.chapterFour.intro) para(content.chapterFour.intro, { after: 10 });
  for (const h of content.chapterFour.herbs) {
    ensure(70);
    heading(h.name, { size: 14, before: 8, after: 2 });
    if (h.latin) para(h.latin, { font: italic, size: 10, color: sage, after: 4 });
    if (h.actions?.length) para("Actions: " + h.actions.map((a) => `${a.term} (${a.translation})`).join(", "), { size: 10, after: 4 });
    if (h.constitutionalMatch) para("Why it matches: " + h.constitutionalMatch, { size: 10.5, after: 3 });
    if (h.preparation) para("Preparation: " + h.preparation, { size: 10.5, after: 3 });
    if (h.safety) para("Safety: " + h.safety, { size: 10.5, color: light, after: 8 });
  }

  // Caution list
  if (content.cautionHerbs?.length) {
    heading("Herbs and Foods to Use With Caution", { size: 15, before: 10 });
    for (const c of content.cautionHerbs) {
      para(c.latin ? `${c.name} (${c.latin})` : c.name, { font: bold, size: 11, after: 2 });
      para(c.reason, { size: 10.5, indent: 14, after: 6 });
    }
  }

  // Chapter Five: lifestyle
  chapterLabel("Chapter Five"); heading(content.chapterFive.subtitle);
  for (const [label, key] of [["Diet", "dietary"], ["Movement", "movement"], ["Rest & Rhythm", "restRhythm"], ["Spiritual Practice", "spiritualPractice"]] as const) {
    const val = (content.chapterFive as Record<string, string>)[key];
    if (val) { heading(label, { size: 12, before: 8, after: 3 }); para(val); }
  }

  // CTAs
  divider();
  if (content.coachingCTA) { heading(content.coachingCTA.title, { size: 14 }); if (content.coachingCTA.intro) para(content.coachingCTA.intro, { after: 4 }); if (content.coachingCTA.body) para(content.coachingCTA.body, { after: 4 }); for (const b of content.coachingCTA.bullets ?? []) bullet(b); }
  if (content.courseCTA) { heading(content.courseCTA.title, { size: 14, before: 14 }); if (content.courseCTA.subtitle) para(content.courseCTA.subtitle, { font: italic, color: sage, after: 4 }); if (content.courseCTA.body) para(content.courseCTA.body, { after: 4 }); for (const b of content.courseCTA.bullets ?? []) bullet(b); }

  // Footer (page numbers; skip cover)
  doc.getPages().forEach((pg, i) => {
    if (i === 0) return;
    pg.drawText("The Eden Institute  -  edeninstitute.health", { x: MARGIN, y: 32, size: 8, font: serif, color: light });
    const num = String(i + 1), w = serif.widthOfTextAtSize(num, 8);
    pg.drawText(num, { x: PAGE_W - MARGIN - w, y: 32, size: 8, font: serif, color: light });
  });

  return await doc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // This EF renders the PAID Deep-Dive Guide. It is fetched server-side by the
  // stripe-webhook (service role) on purchase — never by the public. Require the
  // service role so the paid PDF cannot be pulled directly. verify_jwt=true is
  // locked in config.toml so this claim check cannot be forged.
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(corsHeaders);
  try {
    const url = new URL(req.url);
    const raw = (url.searchParams.get("type") || "").toLowerCase().trim();
    const slug = GUIDES[raw] ? raw : (LEGACY_TYPE_TO_SLUG[raw] ?? "");
    const content = GUIDES[slug];
    if (!content) {
      return new Response(
        JSON.stringify({ error: `Invalid type. Valid patterns: ${Object.keys(GUIDES).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const pdf = await renderFullGuide(content);
    return new Response(pdf as unknown as BodyInit, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Eden-Institute-${slug}-deep-dive-guide.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("constitution-pdf error:", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "PDF generation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
