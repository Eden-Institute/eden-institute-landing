// supabase/functions/_shared/wired-pdf.ts
//
// Fearfully & Wonderfully Wired, W7: the Learner Blueprint and Family Learning Map PDFs (spec 10,
// section 18 answers 29-31, 37). Pure: data in, PDF bytes out, no I/O, so tests can render them.
// Every customer-facing sentence comes from WIRED_PDF_COPY (generated, word for word, from Camila's
// approved files); this module only picks blocks, fills [Nickname]-style brackets and lays them out.
// Text-first, fonts subset, no images: well under the 3 MB budget (spec rule 12).

import { PDFDocument, rgb, PDFName, PDFString, type PDFFont, type PDFPage, type RGB } from "https://esm.sh/pdf-lib@1.17.1";
import * as fontkitModule from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
// esm.sh serves fontkit with a default export at runtime (constitution-pdf imports it that way),
// but its .d.ts declares none, which newer Deno type-checking rejects. Take whichever exists.
// deno-lint-ignore no-explicit-any
const fontkit = ((fontkitModule as any).default ?? fontkitModule) as any;
import * as F from "../constitution-pdf/fonts-b64.ts";
import { WIRED_PDF_COPY as COPY, type CopyItem } from "./wired-pdf-content.ts";
import { DOMAINS, type Domain, type Scores } from "./wired-engine.ts";
import { WIRED_IS_PUBLIC } from "./wired-launch.ts";

// ── Data the builders take ──────────────────────────────────────────────────

export const PDF_SUBJECTS = ["Math", "Language arts", "Science", "History and geography", "Bible"] as const;
export type PdfSubject = typeof PDF_SUBJECTS[number];

/** wired_curricula.subjects values -> the 5 Blueprint subject pages (data mapping, not copy). */
export const SUBJECT_MAP: Record<string, PdfSubject> = {
  "math": "Math",
  "language arts": "Language arts",
  "reading / phonics": "Language arts",
  "writing": "Language arts",
  "science": "Science",
  "history / social studies": "History and geography",
  "geography": "History and geography",
  "bible": "Bible",
};

export interface PdfMatch {
  name: string;
  link: string | null;          // affiliate_url when is_affiliate, else url
  isAffiliate: boolean;
  subjects: PdfSubject[];
  because: string[];            // finished reason lines (reasonLines below)
}

export interface BlueprintData {
  nickname: string;
  grade: number;                // K = 0
  scores: Scores;               // blended
  top3: Domain[];
  answeredOn: Date;             // her answers' date
  observerCount: number;        // other people whose answers are blended in (0 today; W9)
  matches: PdfMatch[];          // already ranked by her own priorities
  comingSoonBand: "6-8" | "9-12" | null;
  now?: Date;
}

export interface FamilyMapData {
  children: BlueprintData[];
  now?: Date;
}

// ── Copy helpers ────────────────────────────────────────────────────────────

const NAMES: Record<Domain, string> = Object.fromEntries(
  DOMAINS.map((d) => [d, COPY.writeups[d]?.name ?? d]),
) as Record<Domain, string>;
export const wiringName = (d: Domain) => NAMES[d];

function block(file: keyof typeof COPY, heading: string): CopyItem[] {
  // deno-lint-ignore no-explicit-any
  const b = (COPY as any)[file]?.[heading] as CopyItem[] | undefined;
  if (!b) throw new Error(`wired-pdf: approved block missing: ${String(file)} / ${heading}`);
  return b;
}

export function fill(s: string, v: Record<string, string>): string {
  return s.replace(/\[([^\]]+)\]/g, (m, k) => (k in v ? v[k] : m));
}

/** "Prefix: rest" -> rest, for the approved files' labelled lines ("Heading:", "Small line:", ...). */
function after(items: CopyItem[], prefix: string): string {
  const it = items.find((i) => i.s.startsWith(prefix));
  if (!it) throw new Error(`wired-pdf: line '${prefix}' missing`);
  return it.s.slice(prefix.length).trim();
}

export function bandOf(grade: number): "K-2" | "3-5" | "6-8" | "9-12" {
  return grade <= 2 ? "K-2" : grade <= 5 ? "3-5" : grade <= 8 ? "6-8" : "9-12";
}

export function lowest3(scores: Scores): Domain[] {
  return DOMAINS.slice().sort((a, b) => scores[a] - scores[b] || DOMAINS.indexOf(a) - DOMAINS.indexOf(b)).slice(0, 3);
}

/** The approved pair blurb for the child's top 2 (key in domain order). */
export function pairBlurb(top3: Domain[]): string | null {
  if (top3.length < 2) return null;
  const [a, b] = top3.slice(0, 2).sort((x, y) => DOMAINS.indexOf(x) - DOMAINS.indexOf(y));
  return COPY.pairs[`${a}+${b}`] ?? null;
}

// The approved "Matched because..." lines, parsed from the results copy (word for word).
const REASON_SRC = Object.fromEntries(
  block("results", "The reason lines").filter((i) => i.t === "li" && !i.s.startsWith("Note:")).map((i) => {
    const k = i.s.slice(0, i.s.indexOf(":"));
    return [k, i.s.slice(k.length + 1).trim().split(" / ")];
  }),
) as Record<string, string[]>;
const PREP_INDEX: Record<string, number> = { open_and_go: 0, light: 1, moderate: 2, heavy: 3 };

export interface ReasonInput {
  because: string[];
  served_top3: Domain[];
  components: Record<string, number>;
  price_cents: number | null;
  prep_load: string;
  esa_state?: string;
}

/** Same rules as the results page (web/components/islands/WiredResults.tsx reasonLines). */
export function reasonLines(m: ReasonInput, nickname: string, top3: Domain[]): string[] {
  const out: string[] = [];
  for (const r of m.because) {
    if (r === "wiring") {
      const s = top3.filter((d) => m.served_top3.includes(d)).map(wiringName);
      const [w3, w2, w1] = REASON_SRC.wiring;
      if (s.length >= 3) out.push(fill(w3, { Nickname: nickname, A: s[0], B: s[1], C: s[2] }));
      else if (s.length === 2) out.push(fill(w2, { Nickname: nickname, A: s[0], B: s[1] }));
      else if (s.length === 1) out.push(fill(w1, { Nickname: nickname, A: s[0] }));
    } else if (r === "budget") {
      const [free, within, over] = REASON_SRC.budget;
      if (m.price_cents === 0) out.push(free);
      else out.push((m.components.budget ?? 0) >= 1 ? within : over);
    } else if (r === "prep") {
      const i = PREP_INDEX[m.prep_load];
      if (i !== undefined) out.push(REASON_SRC.prep[i] + ((m.components.prep ?? 1) < 1 ? ` ${REASON_SRC.prep[4]}` : ""));
    } else if (r === "siblings") out.push(REASON_SRC.siblings[0]);
    else if (r === "esa" && m.esa_state) out.push(fill(REASON_SRC.esa[0], { State: m.esa_state }));
  }
  return out;
}

export function monthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/Chicago" });
}
function longDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
}

// ── Layout engine ───────────────────────────────────────────────────────────

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = { forest: hex("#2B3A1E"), gold: hex("#C5A44E"), cream: hex("#FAF6EE"), olive: hex("#6B7F3A"), body: hex("#2E2A22"), light: hex("#6F675A"), softGold: hex("#E8D5A3") };
const PAGE_W = 612, PAGE_H = 792, M = 66, TOP = 78, BOT = 70, CW = PAGE_W - M * 2;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const tidy = (s: string) => String(s ?? "").replace(/\s*—\s*/g, " – ").replace(/…/g, "...");

type Fonts = { head: PDFFont; headI: PDFFont; body: PDFFont; bodyB: PDFFont; bodyI: PDFFont; caps: PDFFont };

class Writer {
  page!: PDFPage;
  y = 0;
  pageNo = 0;
  footer = "";
  constructor(readonly doc: PDFDocument, readonly f: Fonts) {}

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.cream });
    this.pageNo++;
    if (this.footer) {
      const t = `${this.footer}  ·  ${this.pageNo}`;
      const w = this.f.body.widthOfTextAtSize(t, 8.5);
      this.page.drawText(t, { x: (PAGE_W - w) / 2, y: 36, size: 8.5, font: this.f.body, color: C.light });
    }
    this.y = PAGE_H - TOP;
  }
  ensure(h: number) { if (this.y - h < BOT) this.newPage(); }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const words = tidy(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > width && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  text(s: string, o: { font?: PDFFont; size?: number; color?: RGB; lead?: number; indent?: number; after?: number; center?: boolean } = {}) {
    const font = o.font ?? this.f.body, size = o.size ?? 11.5, lead = o.lead ?? size * 1.42, indent = o.indent ?? 0;
    for (const ln of this.wrap(s, font, size, CW - indent)) {
      this.ensure(lead);
      const x = o.center ? (PAGE_W - font.widthOfTextAtSize(ln, size)) / 2 : M + indent;
      this.page.drawText(ln, { x, y: this.y - size, size, font, color: o.color ?? C.body });
      this.y -= lead;
    }
    this.y -= o.after ?? 8;
  }
  bullet(s: string, o: { size?: number } = {}) {
    const size = o.size ?? 11.5;
    const lines = this.wrap(s, this.f.body, size, CW - 18);
    this.ensure(size * 1.42 * Math.min(lines.length, 6) + 4);
    this.page.drawRectangle({ x: M + 4, y: this.y - size * 0.72, width: 3.4, height: 3.4, color: C.gold });
    this.text(s, { indent: 18, size, after: 4 });
  }
  h1(s: string) {
    this.ensure(70);
    this.text(s, { font: this.f.head, size: 24, color: C.forest, lead: 30, after: 4 });
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + 90, y: this.y }, thickness: 1.2, color: C.gold });
    this.y -= 18;
  }
  h2(s: string) {
    this.ensure(96);
    this.y -= 6;
    this.text(s, { font: this.f.head, size: 15.5, color: C.forest, lead: 20, after: 6 });
  }
  label(s: string) {
    this.ensure(30);
    this.text(s.toUpperCase(), { font: this.f.caps, size: 9.5, color: C.olive, after: 4 });
  }
  verse(s: string) {
    this.ensure(40);
    this.text(s, { font: this.f.headI, size: 12, color: C.forest, after: 10, center: true });
  }
  small(s: string) { this.text(s, { size: 9.5, color: C.light, after: 6 }); }
  /** A line with a clickable link (curriculum name). */
  link(s: string, url: string | null, after = 2) {
    const size = 12.5;
    this.ensure(size * 1.6);
    const font = this.f.bodyB;
    const ln = this.wrap(s, font, size, CW)[0] ?? s;
    this.page.drawText(ln, { x: M, y: this.y - size, size, font, color: C.forest });
    if (url) {
      const w = font.widthOfTextAtSize(ln, size);
      const annot = this.doc.context.obj({
        Type: "Annot", Subtype: "Link", Rect: [M, this.y - size - 2, M + w, this.y + 2], Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
      });
      const ref = this.doc.context.register(annot);
      const annots = this.page.node.lookup(PDFName.of("Annots"));
      // deno-lint-ignore no-explicit-any
      if (annots) (annots as any).push(ref); else this.page.node.set(PDFName.of("Annots"), this.doc.context.obj([ref]));
      this.page.drawLine({ start: { x: M, y: this.y - size - 1.5 }, end: { x: M + w, y: this.y - size - 1.5 }, thickness: 0.5, color: C.gold });
    }
    this.y -= size * 1.5 + after;
  }
  items(items: CopyItem[], v: Record<string, string>) {
    for (const it of items) it.t === "li" ? this.bullet(fill(it.s, v)) : this.text(fill(it.s, v));
  }
  /** A paragraph whose last line is a KJV quote in quotation marks: set the quote apart. */
  itemsWithVerses(items: CopyItem[], v: Record<string, string>) {
    for (const it of items) {
      const s = fill(it.s, v);
      if (/^"/.test(it.s) && it.t !== "li") this.verse(s);
      else if (it.t === "li" && /^"/.test(it.s)) this.verse(s);
      else it.t === "li" ? this.bullet(s) : this.text(s);
    }
  }
}

async function newDoc(title: string): Promise<Writer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setAuthor("The Eden Institute");
  doc.setCreator("The Eden Institute");
  const embed = (b64: string) => doc.embedFont(b64ToBytes(b64), { subset: true });
  const f: Fonts = {
    head: await embed(F.PLAYFAIR_BOLD), headI: await embed(F.PLAYFAIR_ITALIC),
    body: await embed(F.GARAMOND_REGULAR), bodyB: await embed(F.GARAMOND_SEMIBOLD), bodyI: await embed(F.GARAMOND_ITALIC),
    caps: await embed(F.CINZEL_REGULAR),
  };
  return new Writer(doc, f);
}

// ── The Learner Blueprint (answer 30 page order) ────────────────────────────

function writeBlueprint(w: Writer, d: BlueprintData) {
  const name = d.nickname;
  const v = { Nickname: name };
  const top3 = d.top3.slice(0, 3);
  const low3 = lowest3(d.scores);
  const now = d.now ?? new Date();
  w.footer = `${name}'s Learner Blueprint`;

  // 1. Cover and how to use it
  w.newPage();
  const cover = block("blueprint2", "Cover and how to use it");
  w.y = PAGE_H - 210;
  w.text("FEARFULLY & WONDERFULLY WIRED", { font: w.f.caps, size: 10, color: C.olive, center: true, after: 14 });
  w.text(fill(after(cover, "Heading:"), { ...v, "Month Year": monthYear(now) }), { font: w.f.head, size: 28, color: C.forest, center: true, lead: 34, after: 26 });
  for (const it of cover.filter((i) => !/^(Heading|Small line):/.test(i.s))) w.text(fill(it.s, v));
  const smallLine = after(cover, "Small line:");
  w.small(d.observerCount > 0
    ? fill(smallLine, { ...v, date: longDate(d.answeredOn), N: String(d.observerCount) })
    // No observers yet: the bracketed aside has nothing to say, so the sentence ends at the date.
    : fill(smallLine.replace(/\s*\(plus \[N\][^)]*\)/, ""), { ...v, date: longDate(d.answeredOn) }));

  // 2. Top-3 longer write-ups (+ the approved pair blurb for the top 2, answer 37)
  w.newPage();
  w.h1(`${name}'s top 3 wirings`);
  for (const dom of top3) {
    const wu = COPY.writeups[dom];
    w.h2(wu.name);
    for (const p of wu.longer) {
      if (p.lead) w.label(p.lead.replace(/\.$/, ""));
      w.text(fill(p.text, v));
    }
  }
  const pair = pairBlurb(top3);
  if (pair) { w.h2(`${wiringName(top3[0])} + ${wiringName(top3[1])}`); w.text(fill(pair, v)); }

  // 3. Subject-by-subject plan: the opening, then one page per subject
  const plan = block("blueprint2", "Subject-by-subject plan: the opening and the fill-in lines");
  w.newPage();
  w.h1("Subject by subject");
  w.text(fill(plan[0].s, v));
  const fillIns = plan.filter((i) => i.t === "li").map((i) => fill(i.s, v));
  for (const subject of PDF_SUBJECTS) {
    w.newPage();
    w.h1(subject);
    for (const line of fillIns.slice(0, 2)) {
      w.text(line, { font: w.f.bodyB, after: 4 });
      for (let k = 0; k < 2; k++) { w.ensure(26); w.y -= 22; w.page.drawLine({ start: { x: M, y: w.y }, end: { x: M + CW, y: w.y }, thickness: 0.5, color: C.softGold }); }
      w.y -= 14;
    }
    w.text(fillIns[2] ?? "", { font: w.f.bodyB, after: 6 });
    for (const dom of top3) {
      const ways = block("blueprint2", `${wiringName(dom)}: ways in, subject by subject`);
      const line = ways.find((i) => i.s.startsWith(`${subject}:`));
      if (line) { w.label(wiringName(dom)); w.text(fill(line.s.slice(subject.length + 1).trim(), v)); }
    }
  }

  // 4. Daily rhythm and setup
  w.newPage();
  w.h1("Daily rhythm and setup");
  w.items(block("blueprint2", "Daily rhythm and setup: the opening"), v);
  const band = bandOf(d.grade);
  w.h2(`Grades ${band}`);
  w.items(block("blueprint2", `Grades ${band}`), v);
  const setup = block("blueprint2", "Setting up your space, by top wiring").find((i) => i.s.startsWith(`${wiringName(top3[0])}:`));
  if (setup) { w.h2("Setting up your space"); w.text(setup.s.slice(wiringName(top3[0]).length + 1).trim()); }

  // 5. Growing edges (the 3 lowest)
  w.newPage();
  w.h1("Growing edges");
  w.items(block("blueprint1", "Growing edges: what every mom reads first"), v);
  for (const dom of low3) {
    w.h2(wiringName(dom));
    w.items(block("blueprint1", `When ${wiringName(dom)} is a growing edge`), v);
  }

  // 6. Red flags + when to look into an evaluation (answer 28 copy, reused)
  w.newPage();
  const ev = block("results", "When to look into an evaluation");
  w.h1(after(ev, "Heading:"));
  w.items(ev.filter((i) => !i.s.startsWith("Heading:")), v);
  const nd = block("results", "Not a diagnostic tool");
  w.h2(after(nd, "Heading:"));
  w.items(nd.filter((i) => !i.s.startsWith("Heading:")), v);

  // 7. Stewardship and calling (top 3)
  w.newPage();
  w.h1("Stewardship and calling");
  w.itemsWithVerses(block("blueprint1", "Stewardship and calling: the opening"), v);
  for (const dom of top3) {
    w.h2(wiringName(dom));
    w.itemsWithVerses(block("blueprint1", wiringName(dom)), v);
  }

  // 8. Praying for this child
  w.newPage();
  w.h1(fill("Praying for [Nickname]", v));
  w.itemsWithVerses(block("blueprint1", "Praying for [Nickname]: the opening"), v);
  for (const dom of top3) {
    w.h2(wiringName(dom));
    w.itemsWithVerses(block("blueprint1", `For a ${wiringName(dom)}`), v);
  }
  w.h2("The closing prayer");
  w.itemsWithVerses(block("blueprint1", "The closing prayer (every Blueprint)"), v);

  // 9. Curriculum matches by subject
  w.newPage();
  const mp = block("blueprint2", "Curriculum matches by subject");
  w.h1(after(mp, "Heading:"));
  w.text(fill(after(mp, "Under it:"), v));
  const aff = block("results", "Affiliate note");
  const affLine = after(aff, "Right above the matches:");
  const affLabel = after(aff, "Next to each affiliate link, in small print:");
  w.small(affLine);
  const noneLine = after(mp, "If a subject has none:");
  for (const subject of PDF_SUBJECTS) {
    w.h2(subject);
    const list = d.matches.filter((m) => m.subjects.includes(subject)).slice(0, 3);
    if (!list.length) { w.text(fill(noneLine, { ...v, subject: subject.toLowerCase() })); continue; }
    for (const m of list) {
      w.link(m.name, m.link);
      if (m.isAffiliate) w.small(affLabel);
      if (m.because.length) w.text(m.because.join(" · "), { size: 10.5, color: C.light, after: 8 });
    }
  }
  w.small(after(mp, "Small note:"));
  if (d.comingSoonBand) {
    const cs = block("results", "Eden's Table coming-soon line")[0].s;
    w.text(d.comingSoonBand === "9-12" ? cs.replace("grades 6-8", "grades 9-12") : cs, { after: 10 });
  }

  // 10. Year over year: from year 2 only (no child has a year 2 before July 2027), so not rendered yet.

  // Where the ideas come from
  w.h2("Where the ideas come from");
  for (const it of block("blueprint2", "Where the ideas come from")) w.small(it.s);
}

export async function buildBlueprintPdf(d: BlueprintData): Promise<Uint8Array> {
  const w = await newDoc(`${d.nickname}'s Learner Blueprint`);
  writeBlueprint(w, d);
  return await w.doc.save({ useObjectStreams: true });
}

// ── The Family Learning Map ────────────────────────────────────────────────
// Her own teaching-wiring pages need her own answers (adult questions, a later ticket), so the
// first copy skips them, exactly as the approved Family Map delivery email says ("your own
// teaching-wiring pages fill in after you answer your own questions"). Lines that depend on her
// answers (you-and-each-child, the 4-day and planning lines) are left out until then.

export async function buildFamilyMapPdf(d: FamilyMapData): Promise<Uint8Array> {
  const now = d.now ?? new Date();
  const w = await newDoc("Your Family Learning Map");
  w.footer = "Your Family Learning Map";

  w.newPage();
  const cover = block("familyMap", "Family Map cover");
  w.y = PAGE_H - 220;
  w.text("FEARFULLY & WONDERFULLY WIRED", { font: w.f.caps, size: 10, color: C.olive, center: true, after: 14 });
  w.text(fill(after(cover, "Heading:"), { "Month Year": monthYear(now) }), { font: w.f.head, size: 28, color: C.forest, center: true, lead: 34, after: 18 });
  w.verse(after(cover, "Verse:"));
  for (const it of cover.filter((i) => !/^(Heading|Verse):/.test(i.s))) w.text(it.s);
  w.y -= 10;
  for (const c of d.children) w.text(`${c.nickname}: ${c.top3.slice(0, 3).map(wiringName).join(", ")}`, { font: w.f.bodyB, center: true, after: 2 });

  // Teaching your kids together
  w.newPage();
  w.h1("Teaching your kids together");
  const tog = block("familyMap", "Teaching your kids together");
  for (const it of tog) {
    if (it.t !== "li") { w.text(it.s); continue; }
    if (it.s.startsWith("You and each child:")) continue;         // needs her own answers
    if (it.s.startsWith("Wirings your kids share:")) {
      const shared = sharedWirings(d.children);
      if (!shared.length) continue;                                  // "only the lines that apply"
      for (const s of shared) {
        w.bullet(`Wirings your kids share: ${wiringName(s.wiring)} shows up in ${joinNames(s.names)}.`);
      }
      continue;
    }
    w.bullet(it.s);
  }

  w.newPage();
  w.h1("Your family's week");
  for (const it of block("familyMap", "Your family's week")) {
    if (it.t === "li" && /^If (your energy|you lean)/.test(it.s)) continue;   // needs her own answers
    it.t === "li" ? w.bullet(it.s) : w.text(it.s);
  }

  w.newPage();
  w.h1("How your kids' wirings work together");
  for (const it of block("familyMap", "How your kids' wirings work together")) it.t === "li" ? w.bullet(it.s) : w.text(it.s);

  for (const c of d.children) writeBlueprint(w, { ...c, now });
  return await w.doc.save({ useObjectStreams: true });
}

export function sharedWirings(children: BlueprintData[]): { wiring: Domain; names: string[] }[] {
  const out: { wiring: Domain; names: string[] }[] = [];
  for (const dom of DOMAINS) {
    const names = children.filter((c) => c.top3.slice(0, 3).includes(dom)).map((c) => c.nickname);
    if (names.length >= 2) out.push({ wiring: dom, names });
  }
  return out;
}
function joinNames(n: string[]): string {
  return n.length <= 2 ? n.join(" and ") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

// ── The free results PDF (email 1; spec 10, answer 28) ─────────────────────
// The free results page on paper, from the same approved copy: heading + intro, the top-3 SHORT
// write-ups with Bible examples, the pair blurb (answer 37), all 9 as bars, the approach box, the
// 3 tips (her frustration picks the first), up to 5 matches with reasons, then the honest limits.

export interface FreeResultsData extends BlueprintData {
  renaissance: boolean;
  approach: { fits: { approach: string; room_for: Domain[] }[]; already_there: boolean; her_approach: string | null };
  tipFirst: "try_today" | "low_prep" | "together";
}

const APPROACH_LABEL_TO_CODE: Record<string, string> = {
  "Charlotte Mason": "charlotte_mason", "Classical": "classical", "Traditional / textbook": "traditional",
  "Unit study": "unit_study", "Literature-based": "literature", "Montessori": "montessori", "Waldorf": "waldorf",
  "Eclectic / mixed": "eclectic",
};
export const APPROACH_COPY: Record<string, { name: string; description: string }> = Object.fromEntries(
  block("results", "Which approach gives room to which wirings").filter((i) => i.t === "li").flatMap((i) => {
    const name = i.s.slice(0, i.s.indexOf(":"));
    const code = APPROACH_LABEL_TO_CODE[name];
    if (!code) return [];
    const rest = i.s.slice(name.length + 1).trim();
    const cut = rest.indexOf(" Room for:");
    return [[code, { name, description: cut >= 0 ? rest.slice(0, cut) : rest }]];
  }),
);
const TIP_LABELS: Record<string, string> = { try_today: "Try today", low_prep: "Low prep or free", together: "Together, or choosing curriculum" };

export async function buildFreeResultsPdf(d: FreeResultsData): Promise<Uint8Array> {
  const w = await newDoc(`How God wired ${d.nickname}`);
  const name = d.nickname;
  const v = { Nickname: name };
  const top3 = d.top3.slice(0, 3);
  w.footer = `How God wired ${name}`;
  w.newPage();

  const top = block("results", "Top of the page");
  w.text("FEARFULLY & WONDERFULLY WIRED", { font: w.f.caps, size: 10, color: C.olive, after: 10 });
  w.h1(fill(after(top, "Heading:"), v));
  w.text(fill(after(top, "Under it:"), v));
  if (d.renaissance) w.text(fill(block("results", "Renaissance profile (only when the top 5 are within 10 points)")[0].s, v), { font: w.f.bodyB });

  w.h2(fill("[Nickname]'s top 3 wirings", v));
  for (const dom of top3) {
    const wu = COPY.writeups[dom];
    w.label(wu.name);
    for (const s of wu.short) w.text(fill(s, v), { after: 4 });
    w.text(`${wu.bibleLabel}: ${wu.bible}`, { font: w.f.bodyI, size: 10.5, color: C.light, after: 10 });
  }
  const pair = pairBlurb(top3);
  if (pair) { w.label(`${wiringName(top3[0])} + ${wiringName(top3[1])}`); w.text(fill(pair, v)); }

  // All 9 as bars (scores are 0-100), longest first, the scale is 0-100 for every bar.
  const chart = block("results", "The chart of all 9");
  w.newPage();
  w.h1(after(chart, "Heading:"));
  w.text(fill(after(chart, "Caption:"), v), { size: 10.5, color: C.light, after: 12 });
  const sorted = DOMAINS.slice().sort((a, b) => d.scores[b] - d.scores[a] || DOMAINS.indexOf(a) - DOMAINS.indexOf(b));
  const labelW = 110, barMax = CW - labelW - 40;
  for (const dom of sorted) {
    w.ensure(26);
    const val = Math.max(0, Math.min(100, Math.round(d.scores[dom])));
    w.page.drawText(wiringName(dom), { x: M, y: w.y - 13, size: 11.5, font: top3.includes(dom) ? w.f.bodyB : w.f.body, color: C.body });
    w.page.drawRectangle({ x: M + labelW, y: w.y - 15, width: barMax, height: 12, color: C.softGold, opacity: 0.35 });
    w.page.drawRectangle({ x: M + labelW, y: w.y - 15, width: Math.max(2, (barMax * val) / 100), height: 12, color: top3.includes(dom) ? C.forest : C.olive });
    w.y -= 26;
  }
  w.small(after(chart, "Small note under Seeker:"));

  // Approach box
  const box = block("results", "What the approach box says");
  w.h2(fill(after(box, "Heading:"), v));
  for (const f of d.approach.fits) {
    const a = APPROACH_COPY[f.approach];
    if (!a || f.room_for.length < 2) continue;
    w.text(fill(after(box, "Line:"), { ...v, Approach: a.name, "its one-line description": a.description, A: wiringName(f.room_for[0]), B: wiringName(f.room_for[1]) }));
  }
  if (d.approach.her_approach) {
    w.text(after(box, d.approach.already_there ? "If her answer to 'how do you homeschool now' is the same approach:" : "If it's different:"), { font: w.f.bodyI });
  }
  w.small(fill(after(box, "Small note:"), v));

  // 3 tips from the top wiring; her frustration picks the first
  w.h2("3 things to try this week");
  const tips = block("results", `${wiringName(top3[0])}: the 3 tips`);
  const order = [d.tipFirst, ...["try_today", "low_prep", "together"].filter((t) => t !== d.tipFirst)];
  for (const t of order) {
    const it = tips.find((i) => i.s.startsWith(`${TIP_LABELS[t]}:`));
    if (it) w.bullet(fill(it.s, v));
  }

  // Matches (top 5, her priorities)
  const mt = block("results", "Above the curriculum matches");
  w.newPage();
  w.h1(fill(after(mt, "Heading:"), v));
  w.text(after(mt, "Under it:"));
  const aff = block("results", "Affiliate note");
  w.small(after(aff, "Right above the matches:"));
  const affLabel = after(aff, "Next to each affiliate link, in small print:");
  const five = d.matches.slice(0, 5);
  if (!five.length) w.text(fill(after(block("blueprint2", "Curriculum matches by subject"), "If a subject has none:"), { ...v, subject: "every subject" }));
  for (const m of five) {
    w.link(m.name, m.link);
    if (m.isAffiliate) w.small(affLabel);
    if (m.because.length) w.text(m.because.join(" · "), { size: 10.5, color: C.light, after: 8 });
  }
  if (d.comingSoonBand) {
    const cs = block("results", "Eden's Table coming-soon line")[0].s;
    w.text(d.comingSoonBand === "9-12" ? cs.replace("grades 6-8", "grades 9-12") : cs);
  }

  // Honest limits
  const nd = block("results", "Not a diagnostic tool");
  w.h2(after(nd, "Heading:"));
  w.items(nd.filter((i) => !i.s.startsWith("Heading:")), v);
  const ev = block("results", "When to look into an evaluation");
  w.h2(after(ev, "Heading:"));
  w.items(ev.filter((i) => !i.s.startsWith("Heading:")), v);
  return await w.doc.save({ useObjectStreams: true });
}

// ── The curriculum finder shortlist PDF (2026-11-19) ────────────────────────
// One block per curriculum a mom starred on /curriculum-finder: the facts, the free try-before-you-buy
// link, what moms say (pros, cons, sources) and, when she picked a state, whether that state's ESA
// lists it. ⚠️ SHORTLIST_COPY is DRAFT copy, PENDING Camila's approval on the finder review page;
// every fact comes from wired_curricula via curriculum_finder_list().

export interface FinderRow {
  name: string; publisher: string | null; link: string | null; is_affiliate: boolean;
  approach: string | null; subjects: string[]; grade_min: number | null; grade_max: number | null;
  prep_load: string | null; price_cents: number | null; price_basis: string | null; faith_alignment: string | null;
  free_trial_url: string | null; free_trial_note: string | null; completely_free: boolean;
  mom_pros: string[]; mom_cons: string[]; mom_sources: { title?: string; url: string }[]; mom_note: string | null;
  esa_yes_states: string[];
}

export const SHORTLIST_COPY = {
  title: "Your curriculum shortlist",
  intro: "Here are the curricula you starred, with their free samples and what other moms say. Try a free sample before you buy: it's the fastest way to see what fits your family.",
  freeTry: "Try it free",
  noFreeTry: "No free sample found on the publisher's site.",
  completelyFree: "Completely free",
  moms: "What moms say in independent reviews",
  esaYes: (st: string) => `Listed as ESA-eligible in ${st}.`,
  esaNo: (st: string) => `Not listed as ESA-eligible in ${st} yet. Check with your program.`,
  quizTitle: "Not sure which one fits your child?",
  quizLine: "Take the free Fearfully & Wonderfully Wired quiz. It shows how God wired your child and which of these curricula fit them best.",
  quizButton: "Take the Wired quiz",
  quizUrl: "https://edeninstitute.health/wired?utm_source=pdf&utm_medium=shortlist&utm_campaign=curriculum_finder",
};

const gradeLabel = (g: number | null) => (g === null ? "?" : g === 0 ? "K" : String(g));

export async function buildShortlistPdf(d: { items: FinderRow[]; esaState?: string | null; now?: Date }): Promise<Uint8Array> {
  const w = await newDoc(SHORTLIST_COPY.title);
  w.footer = SHORTLIST_COPY.title;
  w.newPage();
  w.text("THE EDEN INSTITUTE", { font: w.f.caps, size: 10, color: C.olive, after: 10 });
  w.h1(SHORTLIST_COPY.title);
  w.text(SHORTLIST_COPY.intro);
  w.small(monthYear(d.now ?? new Date()));
  const aff = block("results", "Affiliate note");
  const affLabel = after(aff, "Next to each affiliate link, in small print:");
  if (d.items.some((i) => i.is_affiliate)) w.small(after(aff, "Right above the matches:"));

  for (const c of d.items) {
    w.ensure(200);
    w.y -= 8;
    w.page.drawLine({ start: { x: M, y: w.y }, end: { x: M + CW, y: w.y }, thickness: 0.6, color: C.softGold });
    w.y -= 14;
    w.link(c.name, c.link);
    if (c.is_affiliate) w.small(affLabel);
    const facts = [
      c.publisher,
      c.grade_min !== null || c.grade_max !== null ? `Grades ${gradeLabel(c.grade_min)}-${gradeLabel(c.grade_max)}` : null,
      c.subjects.length ? c.subjects.join(", ") : null,
      c.approach,
      c.prep_load ? `Prep: ${c.prep_load}` : null,
      c.completely_free ? SHORTLIST_COPY.completelyFree
        : c.price_cents !== null ? `About $${(c.price_cents / 100).toFixed(0)}${c.price_basis ? ` (${c.price_basis.toLowerCase()})` : ""}` : null,
      c.faith_alignment,
    ].filter(Boolean).join("  ·  ");
    w.text(facts, { size: 10.5, color: C.light, after: 6 });
    if (c.free_trial_url) w.link(`${SHORTLIST_COPY.freeTry}: ${c.free_trial_note ?? ""}`.trim(), c.free_trial_url, 4);
    else w.small(SHORTLIST_COPY.noFreeTry);
    if (d.esaState) w.small(c.esa_yes_states.includes(d.esaState) ? SHORTLIST_COPY.esaYes(d.esaState) : SHORTLIST_COPY.esaNo(d.esaState));
    if (c.mom_pros.length || c.mom_cons.length) {
      w.label(SHORTLIST_COPY.moms);
      for (const p of c.mom_pros) w.bullet(`Pro: ${p}`, { size: 10.5 });
      for (const p of c.mom_cons) w.bullet(`Con: ${p}`, { size: 10.5 });
      if (c.mom_note) w.small(c.mom_note);
      if (c.mom_sources.length) w.small(`Sources: ${c.mom_sources.map((s) => s.title || s.url).join("; ")}`);
    }
  }
  // The quiz invitation only once the quiz is public (wired-launch.ts).
  if (WIRED_IS_PUBLIC) {
    w.ensure(120);
    w.h2(SHORTLIST_COPY.quizTitle);
    w.text(SHORTLIST_COPY.quizLine);
    w.link(SHORTLIST_COPY.quizButton, SHORTLIST_COPY.quizUrl);
  }
  return await w.doc.save({ useObjectStreams: true });
}
