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
// NOT public. verify_jwt=true in config.toml, and the handler additionally requires
// a service-role caller (see the isServiceRoleRequest guard below) — this renders
// PAID guide content, so it must never be fetchable with the anon/publishable key.
// Fetched server-side by stripe-webhook on purchase.
//
// DESIGN (2026-09-10 redesign, founder QA: "it needs to look like something people
// would exchange money for"):
//   - Brand fonts (Cinzel eyebrows, Playfair Display titles, EB Garamond body) are
//     embedded from fonts-b64.ts via fontkit. The previous build used pdf-lib's
//     built-in Times Roman, which cannot carry curly quotes, dashes or accents, so
//     every non-ASCII character was flattened to a space or a hyphen.
//   - Brand palette from Eden_Brand_Voice_Guide.docx §4.1-4.2 (the SSOT), not the
//     approximate hexes in src/index.css.
//   - Cover carries a public-domain Köhler botanical plate of one of the pattern's
//     own herbs, fetched from the marketing site (public/guide-plates/<slug>.jpg).
//     The fetch is best-effort: if it fails the cover renders without the plate and
//     the purchase still gets its PDF. Fetch failures are logged.
//   - Contents page, chapter openers with drop caps, numbered herb cards that never
//     split across a page, scripture block, running heads and folios.
//   - Herb actions with an empty translation no longer print as "warming ()".
//   - Em dashes render as spaced en dashes (Eden copy carries no em dashes).

import { PDFDocument, rgb, BlendMode, type PDFFont, type PDFPage, type PDFImage, type RGB } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import type { FullGuideContent } from "../_shared/guide/guide-types.ts";
import { GUIDES_BY_SLUG } from "../_shared/guide/registry.ts";
import { isServiceRoleRequest, serviceRoleRequired } from "../_shared/require-service-role.ts";
import * as F from "./fonts-b64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GUIDES: Record<string, FullGuideContent> = GUIDES_BY_SLUG;

// Backward compatibility: the 4 legacy temperature-by-moisture types map onto a
// representative pattern (the tension axis isn't expressed in the legacy param).
const LEGACY_TYPE_TO_SLUG: Record<string, string> = {
  "hot-dry": "burning-bowstring",
  "hot-damp": "pressure-cooker",
  "cold-dry": "drawn-bowstring",
  "cold-damp": "frozen-knot",
};

// Cover plates live with the marketing site so the /guide page can show the same
// artwork. Override for staging with GUIDE_PLATE_BASE.
const PLATE_BASE = (Deno.env.get("GUIDE_PLATE_BASE") ?? "https://edeninstitute.health/guide-plates").replace(/\/$/, "");
const PLATE_FETCH_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Palette: Eden brand SSOT (Deep Forest Green, Golden Amber, Warm Linen, Deep Cream,
// Dark Walnut, Soft Gold, Sage, Olive, Terracotta).
const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  forest: hex("#2B3A1E"), gold: hex("#C5A44E"), linen: hex("#F5EDD6"), cream: hex("#FAF6EE"),
  walnut: hex("#5C4A28"), softGold: hex("#E8D5A3"), sage: hex("#8A9A5B"), olive: hex("#6B7F3A"),
  terracotta: hex("#B5643C"), white: rgb(1, 1, 1),
  body: hex("#2E2A22"), light: hex("#6F675A"),
};

// US Letter, points.
const PAGE_W = 612, PAGE_H = 792, M = 66, TOP = 78, BOT = 70, CW = PAGE_W - M * 2;

type Fonts = { PfB: PDFFont; PfI: PDFFont; PfR: PDFFont; GaR: PDFFont; GaSB: PDFFont; GaI: PDFFont; CzR: PDFFont; CzB: PDFFont };
type Run = { text: string; font: PDFFont; size: number; color?: RGB };
type Token = { x: number; run: Run; word: string };

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Typographic clean-up only. Real fonts carry curly quotes and accents, so nothing
// is stripped; em dashes become spaced en dashes per Eden copy style.
function fix(s: unknown): string {
  return String(s ?? "").replace(/\s*—\s*/g, " – ").replace(/…/g, "...");
}

async function fetchPlate(slug: string): Promise<Uint8Array | null> {
  const url = `${PLATE_BASE}/${slug}.jpg`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PLATE_FETCH_TIMEOUT_MS) });
    if (!res.ok) { console.warn(`constitution-pdf: plate ${url} -> ${res.status}; rendering cover without it`); return null; }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("jpeg") && !ct.includes("jpg")) { console.warn(`constitution-pdf: plate ${url} content-type ${ct}; skipping`); return null; }
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.warn(`constitution-pdf: plate fetch failed (${err instanceof Error ? err.message : String(err)}); rendering cover without it`);
    return null;
  }
}

async function renderFullGuide(content: FullGuideContent, plateBytes: Uint8Array | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${content.nickname} – Constitutional Deep-Dive Guide`);
  doc.setAuthor("The Eden Institute");
  doc.setSubject(`Your Constitutional Deep-Dive Guide: ${content.constitutionType}`);

  const embed = (b64: string) => doc.embedFont(b64ToBytes(b64), { subset: true });
  const fonts: Fonts = {
    PfR: await embed(F.PLAYFAIR_REGULAR), PfB: await embed(F.PLAYFAIR_BOLD), PfI: await embed(F.PLAYFAIR_ITALIC),
    GaR: await embed(F.GARAMOND_REGULAR), GaSB: await embed(F.GARAMOND_SEMIBOLD), GaI: await embed(F.GARAMOND_ITALIC),
    CzR: await embed(F.CINZEL_REGULAR), CzB: await embed(F.CINZEL_BOLD),
  };
  let plate: PDFImage | null = null;
  if (plateBytes) {
    try { plate = await doc.embedJpg(plateBytes); } catch (err) { console.warn("constitution-pdf: plate embed failed", err instanceof Error ? err.message : String(err)); }
  }

  const { PfB, PfI, GaR, GaSB, GaI, CzR, CzB } = fonts;
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - TOP;
  let chapterRunning = "";
  const pageMeta: { running: string; furniture: boolean }[] = [{ running: "", furniture: false }];

  const paintCream = (pg: PDFPage) => pg.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.cream });
  paintCream(page);
  const newPage = (furniture = true) => {
    page = doc.addPage([PAGE_W, PAGE_H]); paintCream(page); y = PAGE_H - TOP;
    pageMeta.push({ running: chapterRunning, furniture });
  };
  const remaining = () => y - BOT;
  const ensure = (h: number) => { if (remaining() < h) newPage(); };

  // ---- primitives
  function tracked(text: string, font: PDFFont, size: number, x: number, yy: number, color: RGB, spacing: number, align: "left" | "center" | "right" = "left") {
    const t = fix(text).toUpperCase();
    const chars = [...t];
    const w = chars.reduce((a, ch) => a + font.widthOfTextAtSize(ch, size), 0) + spacing * (chars.length - 1);
    let cx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    for (const ch of chars) { page.drawText(ch, { x: cx, y: yy, size, font, color }); cx += font.widthOfTextAtSize(ch, size) + spacing; }
    return w;
  }
  function wrapRuns(runs: Run[], maxW: number): Token[][] {
    const lines: Token[][] = [];
    let line: Token[] = []; let x = 0;
    for (const run of runs) {
      const words = fix(run.text).split(/(\s+)/).filter((w) => w.length);
      for (const w of words) {
        if (/^\s+$/.test(w)) { if (line.length) x += run.font.widthOfTextAtSize(" ", run.size); continue; }
        const ww = run.font.widthOfTextAtSize(w, run.size);
        if (x + ww > maxW && line.length) { lines.push(line); line = []; x = 0; }
        line.push({ x, run, word: w }); x += ww;
      }
    }
    if (line.length) lines.push(line);
    return lines;
  }
  function lineWidth(ln: Token[]): number {
    return ln.reduce((a, t) => Math.max(a, t.x + t.run.font.widthOfTextAtSize(t.word, t.run.size)), 0);
  }
  function drawLines(lines: Token[][], x0: number, lead: number) {
    for (const ln of lines) {
      ensure(lead);
      for (const t of ln) page.drawText(t.word, { x: x0 + t.x, y: y - t.run.size, size: t.run.size, font: t.run.font, color: t.run.color ?? C.body });
      y -= lead;
    }
  }
  function centeredLines(lines: Token[][], yy: number, lead: number): number {
    for (const ln of lines) {
      const w = lineWidth(ln);
      for (const t of ln) page.drawText(t.word, { x: (PAGE_W - w) / 2 + t.x, y: yy, size: t.run.size, font: t.run.font, color: t.run.color ?? C.body });
      yy -= lead;
    }
    return yy;
  }
  function para(text: string, o: { font?: PDFFont; size?: number; color?: RGB; lead?: number; indent?: number; after?: number } = {}) {
    const font = o.font ?? GaR, size = o.size ?? 11.5, lead = o.lead ?? 16.5, indent = o.indent ?? 0;
    drawLines(wrapRuns([{ text, font, size, color: o.color }], CW - indent), M + indent, lead);
    y -= o.after ?? 9;
  }
  // First paragraph of a chapter: gold drop cap, first three lines indented past it.
  function paraDrop(text: string) {
    const t = fix(text);
    if (t.length < 2) return para(t);
    const cap = t[0], rest = t.slice(1);
    const size = 11.5, lead = 16.5, capSize = 42, capW = PfB.widthOfTextAtSize(cap, capSize) + 7;
    ensure(lead * 3 + 4);
    page.drawText(cap, { x: M, y: y - capSize + 8, size: capSize, font: PfB, color: C.gold });
    const words = rest.split(/\s+/).filter(Boolean);
    let i = 0, lineNo = 0;
    while (i < words.length) {
      const lim = lineNo < 3 ? CW - capW : CW; let cur = "";
      while (i < words.length) { const t2 = cur ? cur + " " + words[i] : words[i]; if (GaR.widthOfTextAtSize(t2, size) > lim && cur) break; cur = t2; i++; }
      ensure(lead);
      page.drawText(cur, { x: M + (lineNo < 3 ? capW : 0), y: y - size, size, font: GaR, color: C.body });
      y -= lead; lineNo++;
    }
    y -= 9;
  }
  function label(text: string, o: { color?: RGB; before?: number; after?: number } = {}) {
    y -= o.before ?? 6; ensure(30);
    tracked(text, CzB, 8, M, y - 8, o.color ?? C.sage, 1.6); y -= 8 + (o.after ?? 9);
  }
  function diamond(x: number, yy: number, s: number, color: RGB) {
    page.drawSquare({ x: x - s / 2, y: yy - s / 2, size: s, color, rotate: { type: "degrees", angle: 45 } as never });
  }
  function bullet(text: string, color: RGB = C.gold) {
    const lines = wrapRuns([{ text, font: GaR, size: 11 }], CW - 18);
    ensure(15.5);
    diamond(M + 4, y - 7.5, 4.2, color);
    drawLines(lines, M + 18, 15.5); y -= 3.5;
  }
  function goldRule(width = CW, x = M, withDiamond = true) {
    ensure(14);
    const yy = y - 6;
    if (withDiamond) {
      page.drawLine({ start: { x, y: yy }, end: { x: x + width / 2 - 9, y: yy }, thickness: 0.7, color: C.gold });
      diamond(x + width / 2, yy, 5, C.gold);
      page.drawLine({ start: { x: x + width / 2 + 9, y: yy }, end: { x: x + width, y: yy }, thickness: 0.7, color: C.gold });
    } else page.drawLine({ start: { x, y: yy }, end: { x: x + width, y: yy }, thickness: 0.7, color: C.gold });
    y -= 14;
  }
  function ornament(cx: number, yy: number) {
    page.drawLine({ start: { x: cx - 60, y: yy + 4 }, end: { x: cx - 8, y: yy + 4 }, thickness: 0.7, color: C.gold });
    page.drawSquare({ x: cx - 2.5, y: yy + 1.5, size: 5, color: C.gold, rotate: { type: "degrees", angle: 45 } as never });
    page.drawLine({ start: { x: cx + 8, y: yy + 4 }, end: { x: cx + 60, y: yy + 4 }, thickness: 0.7, color: C.gold });
  }
  function doubleFrame() {
    page.drawRectangle({ x: 30, y: 30, width: PAGE_W - 60, height: PAGE_H - 60, borderColor: C.gold, borderWidth: 1.2 });
    page.drawRectangle({ x: 36, y: 36, width: PAGE_W - 72, height: PAGE_H - 72, borderColor: C.softGold, borderWidth: 0.6 });
  }
  function chapterOpen(num: string, title: string, subtitle: string) {
    chapterRunning = `${content.nickname}  ·  Chapter ${num}`;
    newPage();
    y -= 26;
    tracked(`Chapter ${num}`, CzR, 10, M, y - 10, C.gold, 3); y -= 26;
    for (const ln of wrapRuns([{ text: title, font: PfB, size: 27 }], CW)) { for (const t of ln) page.drawText(t.word, { x: M + t.x, y: y - 27, size: 27, font: PfB, color: C.forest }); y -= 33; }
    y -= 2;
    drawLines(wrapRuns([{ text: subtitle, font: GaI, size: 12.5, color: C.olive }], CW), M, 17);
    y -= 4; goldRule(120, M, false); y -= 10;
  }
  function h3(text: string, o: { size?: number; color?: RGB; before?: number; after?: number } = {}) {
    y -= o.before ?? 8; ensure(50);
    const size = o.size ?? 15;
    for (const ln of wrapRuns([{ text, font: PfB, size }], CW)) { for (const t of ln) page.drawText(t.word, { x: M + t.x, y: y - size, size, font: PfB, color: o.color ?? C.forest }); y -= size + 4; }
    y -= o.after ?? 6;
  }
  function scripture(text: string) {
    const lines = wrapRuns([{ text, font: PfI, size: 12 }], CW - 76);
    const h = lines.length * 18 + 40; ensure(h + 10); y -= 8;
    page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: C.linen });
    page.drawRectangle({ x: M, y: y - h, width: 2.2, height: h, color: C.gold });
    page.drawRectangle({ x: M + CW - 2.2, y: y - h, width: 2.2, height: h, color: C.gold });
    let yy = y - 24;
    for (const ln of lines) {
      const w = lineWidth(ln);
      for (const t of ln) page.drawText(t.word, { x: M + (CW - w) / 2 + t.x, y: yy - 12, size: 12, font: PfI, color: C.forest });
      yy -= 18;
    }
    y -= h + 14;
  }

  // ================= COVER =================
  if (plate) {
    const ph = 400, pw = ph * (plate.width / plate.height);
    // Multiply so the plate's paper disappears into the cream page.
    page.drawImage(plate, { x: (PAGE_W - pw) / 2, y: 58, width: pw, height: ph, blendMode: BlendMode.Multiply, opacity: 0.92 });
  }
  doubleFrame();
  let cy = PAGE_H - 96;
  tracked("The Eden Institute", CzB, 12, PAGE_W / 2, cy, C.gold, 4.5, "center"); cy -= 16;
  centeredLines(wrapRuns([{ text: "Back to Eden. Back to Truth.", font: GaI, size: 11, color: C.walnut }], CW), cy, 15);
  cy -= 40;
  centeredLines(wrapRuns([{ text: "A Constitutional Deep-Dive Guide", font: GaI, size: 14, color: C.olive }], CW), cy, 18);
  cy -= 22; ornament(PAGE_W / 2, cy); cy -= 50;
  { const w = PfB.widthOfTextAtSize(content.nickname, 42); page.drawText(content.nickname, { x: (PAGE_W - w) / 2, y: cy, size: 42, font: PfB, color: C.forest }); }
  cy -= 24;
  tracked(content.constitutionType, CzR, 10.5, PAGE_W / 2, cy, C.walnut, 3.5, "center");
  cy -= 34;
  centeredLines(wrapRuns([{ text: content.tagline, font: GaI, size: 13, color: C.light }], 380), cy, 19);
  if (!plate) ornament(PAGE_W / 2, PAGE_H / 2 - 120);
  tracked("edeninstitute.health", CzR, 8, PAGE_W / 2, 48, C.walnut, 2.5, "center");

  // ================= CONTENTS =================
  newPage(false);
  y -= 30;
  tracked("Inside this guide", CzR, 10, M, y - 10, C.gold, 3); y -= 34;
  page.drawText(fix(`Written for the ${content.nickname.replace(/^The /, "")} pattern  ·  ${content.constitutionType}`), { x: M, y: y - 12, size: 12.5, font: GaI, color: C.olive }); y -= 40;
  const toc: [string, string, string][] = [
    ["One", "Your Pattern", content.chapterOne.subtitle],
    ["Two", "Historical Context", content.chapterTwo.subtitle],
    ["Three", "Biblical Framework", content.chapterThree.subtitle],
    ["Four", "Your Herbal Allies", content.chapterFour.subtitle],
    ["", "Herbs and Foods to Use With Caution", `What may aggravate the ${content.nickname} pattern`],
    ["Five", "Nutrition & Lifestyle", content.chapterFive.subtitle],
    ["", "Your Next Step", "Consultation and the Foundations Course"],
  ];
  for (const [n, t, s] of toc) {
    if (n) tracked(`Chapter ${n}`, CzR, 7.5, M, y - 8, C.sage, 1.8);
    page.drawText(fix(t), { x: M + 92, y: y - 15, size: 15, font: PfB, color: C.forest });
    y -= 20;
    drawLines(wrapRuns([{ text: s, font: GaI, size: 11, color: C.light }], CW - 92), M + 92, 15);
    y -= 6;
    page.drawLine({ start: { x: M + 92, y: y - 2 }, end: { x: M + CW, y: y - 2 }, thickness: 0.4, color: C.softGold });
    y -= 18;
  }

  // ================= CHAPTER ONE =================
  chapterOpen("One", "Your Pattern", content.chapterOne.subtitle);
  content.chapterOne.paragraphs.forEach((p, i) => (i === 0 ? paraDrop(p) : para(p)));
  if (content.chapterOne.physicalTendencies?.length) { label("Physical tendencies", { before: 10 }); for (const t of content.chapterOne.physicalTendencies) bullet(t); }
  if (content.chapterOne.emotionalTendencies?.length) { label("Emotional & mental tendencies", { before: 12 }); for (const t of content.chapterOne.emotionalTendencies) bullet(t); }
  if (content.chapterOne.whenImbalanced) { label("When out of balance", { before: 12 }); para(content.chapterOne.whenImbalanced); }

  // ================= CHAPTER TWO =================
  chapterOpen("Two", "Historical Context", content.chapterTwo.subtitle);
  content.chapterTwo.paragraphs.forEach((p, i) => (i === 0 ? paraDrop(p) : para(p)));

  // ================= CHAPTER THREE =================
  chapterOpen("Three", "Biblical Framework", content.chapterThree.subtitle);
  content.chapterThree.paragraphs.forEach((p, i) => (i === 0 ? paraDrop(p) : para(p)));
  if (content.chapterThree.scriptureVerse) scripture(content.chapterThree.scriptureVerse);
  if (content.chapterThree.closingParagraph) para(content.chapterThree.closingParagraph);

  // ================= CHAPTER FOUR: HERB CARDS =================
  chapterOpen("Four", "Your Herbal Allies", content.chapterFour.subtitle);
  if (content.chapterFour.intro) paraDrop(content.chapterFour.intro);
  y -= 6;
  content.chapterFour.herbs.forEach((h, i) => {
    const actRuns: Run[] = [];
    (h.actions ?? []).forEach((a, ai) => {
      if (ai > 0) actRuns.push({ text: ", ", font: GaR, size: 10.5 });
      actRuns.push({ text: a.term, font: GaSB, size: 10.5, color: C.forest });
      if (a.translation) actRuns.push({ text: ` (${a.translation})`, font: GaI, size: 10.5, color: C.olive });
    });
    const inner = CW - 40;
    const sections: [string, Token[][]][] = [];
    if (actRuns.length) sections.push(["Actions", wrapRuns(actRuns, inner)]);
    if (h.constitutionalMatch) sections.push(["Why it matches you", wrapRuns([{ text: h.constitutionalMatch, font: GaR, size: 10.5 }], inner)]);
    if (h.preparation) sections.push(["Preparation", wrapRuns([{ text: h.preparation, font: GaR, size: 10.5 }], inner)]);
    const safety = h.safety ? wrapRuns([{ text: "Safety  ", font: CzB, size: 7.5, color: C.terracotta }, { text: h.safety, font: GaI, size: 10, color: C.light }], inner) : [];
    const lead = 14.5, labelH = 20, headH = 34;
    let bodyH = 14;
    for (const [, lines] of sections) bodyH += labelH + lines.length * lead + 8;
    if (safety.length) bodyH += 4 + safety.length * lead;
    bodyH += 14;
    const cardH = headH + bodyH;
    // Keep each card whole. A card taller than a page (not the case for any current
    // herb) would still render, just starting on a fresh page.
    ensure(cardH + 6);
    const top = y;
    page.drawRectangle({ x: M, y: top - cardH, width: CW, height: cardH, color: C.white, borderColor: C.softGold, borderWidth: 0.7 });
    page.drawRectangle({ x: M, y: top - headH, width: CW, height: headH, color: C.linen });
    page.drawRectangle({ x: M, y: top - cardH, width: 3, height: cardH, color: C.sage });
    const numTxt = String(i + 1).padStart(2, "0");
    page.drawText(numTxt, { x: M + 16, y: top - 24, size: 17, font: PfB, color: C.gold });
    const nx = M + 16 + PfB.widthOfTextAtSize(numTxt, 17) + 12;
    page.drawText(fix(h.name), { x: nx, y: top - 23, size: 14, font: PfB, color: C.forest });
    if (h.latin) page.drawText(fix(h.latin), { x: nx + PfB.widthOfTextAtSize(fix(h.name), 14) + 10, y: top - 22.5, size: 10.5, font: GaI, color: C.walnut });
    y = top - headH - 14;
    for (const [lab, lines] of sections) {
      tracked(lab, CzB, 7.5, M + 20, y - 8, C.sage, 1.5); y -= labelH;
      for (const ln of lines) { for (const t of ln) page.drawText(t.word, { x: M + 20 + t.x, y: y - t.run.size, size: t.run.size, font: t.run.font, color: t.run.color ?? C.body }); y -= lead; }
      y -= 8;
    }
    if (safety.length) {
      page.drawLine({ start: { x: M + 20, y: y + 2 }, end: { x: M + CW - 20, y: y + 2 }, thickness: 0.4, color: C.softGold });
      y -= 4;
      for (const ln of safety) { for (const t of ln) page.drawText(t.word, { x: M + 20 + t.x, y: y - t.run.size, size: t.run.size, font: t.run.font, color: t.run.color ?? C.body }); y -= lead; }
    }
    y = top - cardH - 14;
  });

  // ================= CAUTION =================
  if (content.cautionHerbs?.length) {
    y -= 6; ensure(120);
    h3("Herbs and Foods to Use With Caution", { size: 19, color: C.walnut, before: 10, after: 2 });
    drawLines(wrapRuns([{ text: `The following may aggravate the ${content.nickname} pattern if used excessively.`, font: GaI, size: 11.5, color: C.light }], CW), M, 16);
    y -= 8;
    for (const c of content.cautionHerbs) {
      const runs: Run[] = [{ text: c.name, font: GaSB, size: 11, color: C.walnut }];
      if (c.latin) runs.push({ text: ` (${c.latin})`, font: GaI, size: 10.5, color: C.light });
      runs.push({ text: `  –  ${c.reason}`, font: GaR, size: 11 });
      const lines = wrapRuns(runs, CW - 18); ensure(15.5 * lines.length + 4);
      diamond(M + 4, y - 7.5, 4.2, C.terracotta);
      drawLines(lines, M + 18, 15.5); y -= 4;
    }
  }

  // ================= CHAPTER FIVE =================
  chapterOpen("Five", "Nutrition & Lifestyle", content.chapterFive.subtitle);
  const five: [string, string][] = [["Dietary guidance", content.chapterFive.dietary], ["Movement", content.chapterFive.movement], ["Rest & rhythm", content.chapterFive.restRhythm], ["Spiritual practice", content.chapterFive.spiritualPractice]];
  let firstFive = true;
  for (const [lab, val] of five) { if (!val) continue; label(lab, { before: firstFive ? 0 : 12 }); para(val); firstFive = false; }

  // ================= NEXT STEP =================
  chapterRunning = `${content.nickname}  ·  Your Next Step`;
  newPage(); y -= 26;
  tracked("Your next step", CzR, 10, M, y - 10, C.gold, 3); y -= 30;
  if (content.coachingCTA) {
    h3(content.coachingCTA.title, { size: 22, before: 0, after: 2 });
    if (content.coachingCTA.intro) { drawLines(wrapRuns([{ text: content.coachingCTA.intro, font: GaI, size: 12, color: C.olive }], CW), M, 17); y -= 8; }
    if (content.coachingCTA.body) para(content.coachingCTA.body);
    if (content.coachingCTA.bullets?.length) { label("In a 1:1 constitutional consultation, we will", { before: 4 }); for (const b of content.coachingCTA.bullets) bullet(b); }
    y -= 10; ensure(80);
    page.drawRectangle({ x: M, y: y - 64, width: CW, height: 64, color: C.linen, borderColor: C.gold, borderWidth: 1 });
    { const t = "1:1 Constitutional Consultation"; const w = PfB.widthOfTextAtSize(t, 15); page.drawText(t, { x: (PAGE_W - w) / 2, y: y - 26, size: 15, font: PfB, color: C.forest }); }
    tracked("Coming soon  ·  edeninstitute.health", CzR, 8, PAGE_W / 2, y - 48, C.walnut, 2, "center");
    y -= 90;
  }
  if (content.courseCTA) {
    goldRule(); y -= 14;
    h3(content.courseCTA.title, { size: 22, before: 0, after: 2 });
    if (content.courseCTA.subtitle) { tracked(content.courseCTA.subtitle, CzR, 8, M, y - 8, C.sage, 1.8); y -= 24; }
    if (content.courseCTA.body) para(content.courseCTA.body);
    if (content.courseCTA.bullets?.length) { label("In the Foundations Course, you will discover", { before: 4 }); for (const b of content.courseCTA.bullets) bullet(b); }
    y -= 10; ensure(96);
    page.drawRectangle({ x: M, y: y - 90, width: CW, height: 90, color: C.forest });
    { const t = "The Foundations Course"; const w = PfB.widthOfTextAtSize(t, 17); page.drawText(t, { x: (PAGE_W - w) / 2, y: y - 30, size: 17, font: PfB, color: C.cream }); }
    { const t = "Learn to read your body pattern and match it to God's provision in the plant world."; const w = GaI.widthOfTextAtSize(t, 10.5); page.drawText(t, { x: (PAGE_W - w) / 2, y: y - 48, size: 10.5, font: GaI, color: C.softGold }); }
    page.drawRectangle({ x: PAGE_W / 2 - 92, y: y - 80, width: 184, height: 22, color: C.gold });
    tracked("learn.edeninstitute.health", CzB, 8, PAGE_W / 2, y - 73, C.forest, 1.8, "center");
    y -= 90;
  }

  // ================= CLOSING =================
  newPage(false);
  doubleFrame();
  let zy = PAGE_H / 2 + 60;
  tracked("The Eden Institute", CzB, 13, PAGE_W / 2, zy, C.forest, 5, "center"); zy -= 20;
  centeredLines(wrapRuns([{ text: "Back to Eden. Back to Truth.", font: GaI, size: 12, color: C.olive }], CW), zy, 16);
  zy -= 30; ornament(PAGE_W / 2, zy); zy -= 40;
  zy = centeredLines(wrapRuns([{ text: "This guide is educational only and does not constitute medical advice. For complex or serious health concerns, consult a qualified practitioner.", font: GaI, size: 10.5, color: C.light }], 380), zy, 15);
  zy -= 20;
  tracked(`© ${new Date().getFullYear()} The Eden Institute  ·  edeninstitute.health`, CzR, 7.5, PAGE_W / 2, zy, C.walnut, 2, "center");

  // ================= RUNNING HEADS + FOLIOS =================
  doc.getPages().forEach((pg, i) => {
    const meta = pageMeta[i]; if (!meta || !meta.furniture) return;
    const yy = PAGE_H - 44;
    let cx = M;
    for (const ch of [...fix(meta.running).toUpperCase()]) { pg.drawText(ch, { x: cx, y: yy, size: 7.5, font: CzR, color: C.light }); cx += CzR.widthOfTextAtSize(ch, 7.5) + 1.6; }
    pg.drawLine({ start: { x: M, y: yy - 8 }, end: { x: PAGE_W - M, y: yy - 8 }, thickness: 0.4, color: C.softGold });
    pg.drawLine({ start: { x: M, y: 46 }, end: { x: PAGE_W - M, y: 46 }, thickness: 0.4, color: C.softGold });
    pg.drawText("The Eden Institute  ·  edeninstitute.health", { x: M, y: 33, size: 8.5, font: GaI, color: C.light });
    const num = String(i + 1); const w = GaR.widthOfTextAtSize(num, 8.5);
    pg.drawText(num, { x: PAGE_W - M - w, y: 33, size: 8.5, font: GaR, color: C.light });
  });

  return await doc.save();
}

export { renderFullGuide };

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
    // Also accept the eden_patterns DB form ("the_pressure_cooker") alongside the
    // registry key ("pressure-cooker"). stripe-webhook now sends a canonical slug,
    // but Stripe sessions created before that fix are still in flight, and the two
    // naming schemes have drifted apart once already.
    const normalized = raw.replace(/^the[_-]/, "").replace(/_/g, "-");
    const slug = GUIDES[raw]
      ? raw
      : GUIDES[normalized]
        ? normalized
        : (LEGACY_TYPE_TO_SLUG[raw] ?? LEGACY_TYPE_TO_SLUG[normalized] ?? "");
    const content = GUIDES[slug];
    if (!content) {
      return new Response(
        JSON.stringify({ error: `Invalid type. Valid patterns: ${Object.keys(GUIDES).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const plate = await fetchPlate(slug);
    const pdf = await renderFullGuide(content, plate);
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
