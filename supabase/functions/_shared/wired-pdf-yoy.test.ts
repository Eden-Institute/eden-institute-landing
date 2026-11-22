// Wired quiz finding 4 (founder-approved 2026-11-21): the Learner Blueprint's year-over-year page, from year 2 on.
// No child has a year 2 before July 2027, so this proves it with fake data: the conditional lines, the render (text
// read back OUT of the PDF bytes through each font's ToUnicode map), word for word against the approved copy, and the
// loader through a PostgREST fake that only knows the REAL columns (read from supabase/migrations/).
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, type PDFRawStream, PDFRef } from "https://esm.sh/pdf-lib@1.17.1";
import { DOMAINS, type Domain, type Scores } from "./wired-engine.ts";
import { bandOfSetKind, type BlueprintData, buildBlueprintPdf, buildFamilyMapPdf, fill, grewTheMost, newInTop3, wiringName, yearOverYear } from "./wired-pdf.ts";
import { loadBlueprintData, type PdfJob, renderJob } from "./wired-pdf-job.ts";

// ── Fixtures ────────────────────────────────────────────────────────────────

const sc = (o: Partial<Record<Domain, number>>): Scores =>
  Object.fromEntries(DOMAINS.map((d) => [d, o[d] ?? 30])) as Scores;
const LAST = sc({ maker: 88, storyteller: 70, designer: 66, cultivator: 45, connector: 50 });
const NOW = sc({ maker: 90, storyteller: 52, designer: 68, cultivator: 70.5, connector: 50 });

const base: BlueprintData = {
  nickname: "Lily", grade: 6, scores: NOW, top3: ["maker", "cultivator", "designer"], answeredOn: new Date("2027-08-02T18:00:00Z"),
  observerCount: 2, matches: [{ name: "Math-U-See", link: "https://example.com/mus", isAffiliate: false, subjects: ["Math"], because: ["Free"] }],
  comingSoonBand: null, now: new Date("2027-08-02T18:00:00Z"), questionBand: "6-8",
};
const withPrior: BlueprintData = {
  ...base,
  priorYear: { quizYear: 2026, scores: LAST, top3: ["maker", "storyteller", "designer"], otherCount: 1, band: "3-5" },
};

const MD = await Deno.readTextFile(new URL("../../../docs/wired-copy/Wired_Quiz_Blueprint_Part2.md", import.meta.url));
const SECTION = MD.slice(MD.indexOf("### Year over year"), MD.indexOf("### Where the ideas come from"));

/** Is this rendered sentence the approved one, word for word, once the brackets are filled? */
function approved(sentence: string, v: Record<string, string>): boolean {
  return [...DOMAINS.map((d) => wiringName(d)), ""].some((w) => fill(SECTION, { ...v, ...(w ? { Wiring: w } : {}) }).includes(sentence));
}

// ── Text out of the PDF bytes ───────────────────────────────────────────────

const latin1 = new TextDecoder("latin1");
const utf16 = (hex: string) => {
  let s = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return s;
};

/** Every drawText line, page by page, decoded through the font's ToUnicode CMap (what a PDF reader would copy out). */
async function pdfLines(bytes: Uint8Array): Promise<string[][]> {
  const doc = await PDFDocument.load(bytes);
  const cmaps = new Map<string, Map<string, string>>();
  const cmapOf = (ref: PDFRef): Map<string, string> => {
    const hit = cmaps.get(ref.toString());
    if (hit) return hit;
    const m = new Map<string, string>();
    const font = doc.context.lookup(ref, PDFDict);
    const src = latin1.decode(decodePDFRawStream(font.lookup(PDFName.of("ToUnicode")) as PDFRawStream).decode());
    for (const blk of src.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const [, g, u] of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) m.set(g.toUpperCase(), utf16(u));
    }
    for (const blk of src.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const [, a, b, u] of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        for (let g = parseInt(a, 16); g <= parseInt(b, 16); g++) {
          m.set(g.toString(16).toUpperCase().padStart(a.length, "0"), String.fromCharCode(parseInt(u, 16) + g - parseInt(a, 16)));
        }
      }
    }
    cmaps.set(ref.toString(), m);
    return m;
  };
  return doc.getPages().map((page) => {
    const fonts = new Map<string, Map<string, string>>();
    const fd = page.node.Resources()?.lookupMaybe(PDFName.of("Font"), PDFDict);
    for (const [name, ref] of fd?.entries() ?? []) fonts.set(name.asString().replace(/^\//, ""), cmapOf(ref as PDFRef));
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : contents ? [contents] : [];
    const lines: string[] = [];
    for (const s of streams) {
      const ops = latin1.decode(decodePDFRawStream(s as PDFRawStream).decode());
      let cur: Map<string, string> | undefined;
      for (const m of ops.matchAll(/\/([^\s\/<>\[\]()]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]*)>\s*Tj/g)) {
        if (m[1] !== undefined) { cur = fonts.get(m[1]); continue; }
        if (!cur) throw new Error("text drawn before any font was set");
        let t = "";
        for (let i = 0; i + 4 <= m[2].length; i += 4) t += cur.get(m[2].slice(i, i + 4).toUpperCase()) ?? "�";
        lines.push(t);
      }
    }
    return lines;
  });
}
const flat = (lines: string[]) => lines.join(" ").replace(/\s+/g, " ").trim();

function expectedSentences(d: BlueprintData): string[] {
  const t = yearOverYear(d)!;
  return [t.heading, t.caption, ...t.lines, ...t.normal, ...(t.raters ? [t.raters] : []), ...(t.grades ? [t.grades] : []), t.closing];
}

// ── (1) The lines that apply ────────────────────────────────────────────────

Deno.test("yoy lines: grew the most, same top wiring, new in the top 3 (one line each, approved order)", () => {
  const t = yearOverYear(withPrior)!;
  assertEquals(t.lines, [
    "Grew the most: Cultivator.",                 // +25.5, the largest rise
    "Same top wiring as last year: Maker.",       // top3[0] maker both years
    "New in the top 3 this year: Cultivator.",    // storyteller dropped out
  ]);
});

Deno.test("yoy lines: grew the most = largest positive change; omitted when nothing rose; ties go to DOMAINS order", () => {
  assertEquals(grewTheMost(NOW, LAST), "cultivator");
  assertEquals(grewTheMost(LAST, LAST), null);                                    // nothing changed
  assertEquals(grewTheMost(sc({ maker: 10 }), sc({ maker: 50 })), null);          // only drops
  assertEquals(grewTheMost(sc({ seeker: 40, organizer: 40 }), sc({})), "organizer"); // tie +10: organizer comes first in DOMAINS
  assertEquals(grewTheMost(sc({ psalmist: 30.1 }), sc({ psalmist: 30.0 })), "psalmist"); // +0.1 (the blend's precision) counts
  assertEquals(grewTheMost(sc({ psalmist: 0.1 + 0.2 }), sc({ psalmist: 0.3 })), null);   // float noise is not growth
  const none = yearOverYear({ ...withPrior, scores: sc({ maker: 80 }), top3: ["maker", "storyteller", "designer"], priorYear: { ...withPrior.priorYear!, scores: sc({ maker: 90 }) } })!;
  assert(!none.lines.some((l) => l.startsWith("Grew the most:")), "no wiring rose: no line");
});

Deno.test("yoy lines: same top only when the top wiring is unchanged; new in top 3 lists every newcomer, none when unchanged", () => {
  const changedTop = yearOverYear({ ...withPrior, top3: ["cultivator", "maker", "designer"] })!;
  assert(!changedTop.lines.some((l) => l.startsWith("Same top wiring")));
  const two = newInTop3(["seeker", "maker", "ponderer"], ["maker", "storyteller", "designer"]);
  assertEquals(two, ["seeker", "ponderer"]);
  const t = yearOverYear({ ...withPrior, top3: ["seeker", "maker", "ponderer"] })!;
  assertEquals(t.lines.filter((l) => l.startsWith("New in the top 3")), ["New in the top 3 this year: Seeker.", "New in the top 3 this year: Ponderer."]);
  // Only the first 3 of either list count.
  assertEquals(newInTop3(["maker", "storyteller", "designer", "seeker"], ["designer", "storyteller", "maker", "ponderer"]), []);
  // Same top 3 in a new order, same scores: only the same-top line.
  const same = yearOverYear({ ...withPrior, scores: LAST, top3: ["maker", "storyteller", "designer"] })!;
  assertEquals(same.lines, ["Same top wiring as last year: Maker."]);
  // Everything different and nothing rose: no lines at all, the rest of the page still there.
  const bare = yearOverYear({ ...withPrior, scores: sc({}), top3: ["seeker", "ponderer", "psalmist"], priorYear: { ...withPrior.priorYear!, scores: sc({ seeker: 31, ponderer: 31, psalmist: 31, maker: 31 }), top3: ["maker", "storyteller", "designer"] } })!;
  assertEquals(bare.lines.filter((l) => !l.startsWith("New in")), []);
  assertEquals(bare.closing, "Take a minute to thank God for how Lily has grown this year.");
});

// ── (2) The raters line ─────────────────────────────────────────────────────

Deno.test("yoy raters line: only when the number of other people changed, with N (this year) and M (last year)", () => {
  assertEquals(yearOverYear(withPrior)!.raters,
    "This year's results include 2 other people's answers and last year's included 1, so some differences come from the extra views.");
  assertEquals(yearOverYear({ ...withPrior, observerCount: 1 })!.raters, null);
  assertEquals(yearOverYear({ ...withPrior, observerCount: 0, priorYear: { ...withPrior.priorYear!, otherCount: 0 } })!.raters, null);
  assertEquals(yearOverYear({ ...withPrior, observerCount: 0, priorYear: { ...withPrior.priorYear!, otherCount: 3 } })!.raters,
    "This year's results include 0 other people's answers and last year's included 3, so some differences come from the extra views.");
});

// ── (3) The grade-set line ──────────────────────────────────────────────────

Deno.test("yoy grade-set line: only when the band changed; bands print as K-2, 3-5, 6-8, 9-12", () => {
  assertEquals(yearOverYear(withPrior)!.grades,
    "This year you answered the grades 6-8 questions about Lily, and last year it was the grades 3-5 questions. The questions grow with your child, so read the changes as a rough guide, not an exact match.");
  assertEquals(yearOverYear({ ...withPrior, questionBand: "3-5" })!.grades, null);                 // same set
  assertEquals(yearOverYear({ ...withPrior, questionBand: null })!.grades, null);                  // this year's set unknown
  assertEquals(yearOverYear({ ...withPrior, priorYear: { ...withPrior.priorYear!, band: null } })!.grades, null); // last year's unknown
  const k = yearOverYear({ ...withPrior, questionBand: "3-5", priorYear: { ...withPrior.priorYear!, band: "K-2" } })!.grades!;
  assertStringIncludes(k, "the grades 3-5 questions about Lily, and last year it was the grades K-2 questions.");
  const h = yearOverYear({ ...withPrior, questionBand: "9-12", priorYear: { ...withPrior.priorYear!, band: "6-8" } })!.grades!;
  assertStringIncludes(h, "the grades 9-12 questions about Lily, and last year it was the grades 6-8 questions.");
  // The set kinds the banks store -> the band; the teen and adult sets are not a grade band.
  assertEquals(["k2", "g3_5", "g6_8", "g9_12", "teen", "adult", null, undefined, "x"].map(bandOfSetKind), ["K-2", "3-5", "6-8", "9-12", null, null, null, null, null]);
});

// ── (4) The render, (5) word for word ──────────────────────────────────────

Deno.test("yoy render: a child WITH an earlier year gets one new page with every applicable line; WITHOUT, none of it", async () => {
  const without = await buildBlueprintPdf(base);
  const withIt = await buildBlueprintPdf(withPrior);
  const pagesWithout = await pdfLines(without), pagesWith = await pdfLines(withIt);
  assert(withIt.length < 3 * 1024 * 1024, `size ${withIt.length}`);

  const all = flat(pagesWith.flat());
  for (const s of expectedSentences(withPrior)) assertStringIncludes(all, s);
  const yoyPage = pagesWith.findIndex((p) => flat(p).includes("How Lily has grown since last July"));
  assertEquals(pagesWith.filter((p) => flat(p).includes("How Lily has grown since last July")).length, 1);
  // One new page; with every conditional line drawn (this fixture), the existing sources section flows onto the next.
  const spill = flat(pagesWith[yoyPage]).includes("Where the ideas come from") ? 0 : 1;
  assertEquals(spill, 1);
  assertEquals(pagesWith.length, pagesWithout.length + 1 + spill);
  // Right after the curriculum matches page(s), before "Where the ideas come from".
  assert(flat(pagesWith[yoyPage - 1]).includes("Curriculum matches by subject") || flat(pagesWith[yoyPage - 1]).includes("All-in-one curricula show under every subject they cover."));
  const sources = pagesWith.findIndex((p) => flat(p).includes("Where the ideas come from"));
  assert(sources >= yoyPage, "sources come after the page");
  // The chart: every wiring with last year's and this year's number.
  for (const d of DOMAINS) assert(pagesWith[yoyPage].includes(wiringName(d)), d);
  assert(pagesWith[yoyPage].includes("45") && pagesWith[yoyPage].includes("71"), "cultivator 45 -> 70.5 (71)");

  // Without an earlier year: none of the page's words anywhere, and every other page reads exactly the same.
  const none = flat(pagesWithout.flat());
  for (const s of ["How Lily has grown since last July", "Last year's bar sits next to this year's", "Some change is normal.", "thank God for how Lily has grown", "Grew the most:", "Same top wiring as last year:", "New in the top 3 this year:", "other people's answers and last year's", "questions grow with your child"]) {
    assert(!none.includes(s), `unexpected: ${s}`);
  }
  const strip = (p: string[]) => p.filter((l) => !/Learner Blueprint\s+·\s+\d+$/.test(l));
  assertEquals(pagesWith.slice(0, yoyPage - 1).map(strip), pagesWithout.slice(0, yoyPage - 1).map(strip));
  // The matches page: the same lines, less the sources section that now follows the new page instead.
  const mWith = strip(pagesWith[yoyPage - 1]), mWithout = strip(pagesWithout[yoyPage - 1]);
  assertEquals(mWithout.slice(0, mWith.length), mWith);
  assertEquals(flat(mWithout.slice(mWith.length)).startsWith("Where the ideas come from"), true);
  if (Deno.env.get("WIRED_PDF_OUT")) await Deno.writeFile(`${Deno.env.get("WIRED_PDF_OUT")}/blueprint_yoy.pdf`, withIt);
});

Deno.test("yoy render: only the lines that apply are drawn (no raters or grade line when nothing changed)", async () => {
  const d: BlueprintData = { ...withPrior, observerCount: 1, questionBand: "3-5", top3: ["maker", "storyteller", "designer"], scores: LAST };
  const pages = await pdfLines(await buildBlueprintPdf(d));
  const all = flat(pages.flat());
  // Fewer lines: exactly one page more than without, the sources section sharing the new page.
  assertEquals(pages.length, (await pdfLines(await buildBlueprintPdf(base))).length + 1);
  assert(flat(pages.find((p) => flat(p).includes("How Lily has grown since last July"))!).includes("Where the ideas come from"));
  assertStringIncludes(all, "Same top wiring as last year: Maker.");
  for (const s of ["Grew the most:", "New in the top 3 this year:", "other people's answers", "questions grow with your child"]) assert(!all.includes(s), s);
  assertStringIncludes(all, "Some change is normal.");
  assertStringIncludes(all, "Take a minute to thank God for how Lily has grown this year.");
});

Deno.test("yoy word for word: every sentence on the page is the approved copy, and the page carries no other words", async () => {
  const v = { Nickname: "Lily", N: "2", M: "1", "new band": "6-8", "old band": "3-5" };
  const sentences = expectedSentences(withPrior);
  for (const s of sentences) {
    assert(approved(s, v), `not word for word in Wired_Quiz_Blueprint_Part2.md: ${s}`);
    assert(!/[—–]/.test(s), `dash in: ${s}`);
    assert(!/\[[^\]]+\]/.test(s), `unfilled bracket in: ${s}`);
    assert(!/APPROVED|Bands print as|\(only the ones that apply\)/.test(s), `note leaked into: ${s}`);
  }
  // The page as a reader copies it: footer, chart labels and numbers aside, exactly these sentences in this order
  // (then, when it fits, the existing "Where the ideas come from" section).
  const pages = await pdfLines(await buildBlueprintPdf(withPrior));
  const page = pages.find((p) => flat(p).includes("How Lily has grown since last July"))!;
  const names = new Set(DOMAINS.map(wiringName));
  const words = flat(page.filter((l) => !/Learner Blueprint\s+·\s+\d+$/.test(l) && !names.has(l) && !/^\d+$/.test(l)));
  const expected = sentences.join(" ");
  assert(words === expected || words.startsWith(`${expected} Where the ideas come from`), `page text:\n${words}\n\nexpected:\n${expected}`);
});

Deno.test("yoy Family Map: each child's Blueprint inside it gets the page only when that child has an earlier year; 6 children stay under 3 MB", async () => {
  const ben: BlueprintData = { ...base, nickname: "Ben", grade: 2, top3: ["storyteller", "maker", "seeker"], questionBand: "K-2" };
  const pages = await pdfLines(await buildFamilyMapPdf({ children: [withPrior, ben], now: base.now }));
  const all = flat(pages.flat());
  assertStringIncludes(all, "How Lily has grown since last July");
  assert(!all.includes("How Ben has grown since last July"));
  assertEquals(pages.filter((p) => flat(p).includes("has grown since last July")).length, 1);
  for (const s of expectedSentences(withPrior)) assertStringIncludes(all, s);

  const raters = ["mom", "teen", "observer", "observer", "observer"].map((role, i) => ({ role, label: role === "observer" ? `Helper ${i}` : null, scores: NOW, top3: withPrior.top3 }));
  const six = ["Lily", "Ben", "Ana", "Sam", "Joy", "Eli"].map((n, i) => ({ ...withPrior, nickname: n, grade: i * 2, raters, observerCount: 4 }));
  const bytes = await buildFamilyMapPdf({ children: six, now: base.now });
  assert(bytes.length < 3 * 1024 * 1024, `size ${bytes.length}`);
  console.log("family map, 6 children with a year 2 + 5 people each: bytes", bytes.length);
});

// ── The loader, through a PostgREST fake that knows only the real columns ──

/** Every table's real columns, from the migrations (create table bodies + add column), so a fake can't invent one. */
async function realColumns(): Promise<Record<string, Set<string>>> {
  const dir = new URL("../../migrations/", import.meta.url);
  const out: Record<string, Set<string>> = {};
  const names: string[] = [];
  for await (const e of Deno.readDir(dir)) if (e.name.endsWith(".sql")) names.push(e.name);
  for (const n of names.sort()) {
    const sql = (await Deno.readTextFile(new URL(n, dir))).replace(/--[^\n]*/g, "");
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      const set = out[m[1]] ??= new Set();
      for (const line of m[2].split("\n")) {
        const w = line.trim().match(/^([a-z_][a-z0-9_]*)\s/i)?.[1];
        if (w && !/^(check|primary|unique|constraint|foreign|exclude)$/i.test(w)) set.add(w);
      }
    }
    for (const stmt of sql.split(";")) {
      const t = stmt.match(/^\s*alter table (?:if exists )?(?:only )?public\.(\w+)/i)?.[1];
      if (!t) continue;
      for (const c of stmt.matchAll(/add column (?:if not exists )?(\w+)/gi)) (out[t] ??= new Set()).add(c[1]);
    }
  }
  return out;
}
const COLS = await realColumns();

type Row = Record<string, unknown>;
type Seen = { path: string };

/** A strict PostgREST: unknown table or column -> 4xx (like the real one); eq/lt/in/is filters, order, limit, select. */
function installDb(tables: Record<string, Row[]>): Seen[] {
  for (const [t, rows] of Object.entries(tables)) {
    for (const r of rows) for (const k of Object.keys(r)) if (!COLS[t]?.has(k)) throw new Error(`fixture invents ${t}.${k}`);
  }
  const seen: Seen[] = [];
  globalThis.fetch = ((input: string | URL) => {
    const path = String(input).split("/rest/v1/")[1] ?? "";
    seen.push({ path: decodeURIComponent(path) });
    const j = (v: unknown, s = 200) => Promise.resolve(new Response(JSON.stringify(v), { status: s }));
    const [table, qs = ""] = path.split("?");
    // The curricula reads are untouched by this change and only feed the matches; an empty list is enough here.
    if (table === "wired_curricula" || table === "wired_curriculum_esa") return j([]);
    const real = COLS[table];
    if (!real) return j({ code: "42P01", message: `relation public.${table} does not exist` }, 404);
    const bad = (c: string) => j({ code: "42703", message: `column ${table}.${c} does not exist` }, 400);
    let rows = [...(tables[table] ?? [])];
    let select: string[] = [];
    let order: { col: string; desc: boolean } | null = null;
    let limit = Infinity;
    for (const part of qs.split("&").filter(Boolean)) {
      const at = part.indexOf("=");
      const key = part.slice(0, at), val = decodeURIComponent(part.slice(at + 1));
      if (key === "select") { select = val.split(","); continue; }
      if (key === "limit") { limit = Number(val); continue; }
      if (key === "order") { const [col, dir] = val.split("."); if (!real.has(col)) return bad(col); order = { col, desc: dir === "desc" }; continue; }
      if (!real.has(key)) return bad(key);
      let pred: (x: unknown) => boolean;
      if (val.startsWith("eq.")) pred = (x) => String(x) === val.slice(3);
      else if (val.startsWith("lt.")) pred = (x) => Number(x) < Number(val.slice(3));
      else if (val.startsWith("in.(")) { const set = val.slice(4, -1).split(","); pred = (x) => set.includes(String(x)); }
      else if (val === "is.null") pred = (x) => x === null || x === undefined;
      else if (val === "not.is.null") pred = (x) => x !== null && x !== undefined;
      else throw new Error(`fake PostgREST: operator not modelled: ${part}`);
      rows = rows.filter((r) => pred(r[key]));
    }
    for (const c of select) if (!real.has(c)) return bad(c);
    if (order) {
      const { col, desc } = order;
      rows.sort((a, b) => { const x = a[col] as string | number, y = b[col] as string | number; return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1); });
    }
    return j(rows.slice(0, limit).map((r) => Object.fromEntries(select.map((c) => [c, r[c] ?? null]))));
  }) as typeof fetch;
  return seen;
}

const DB = { url: "https://db", key: "k" };
const FAM = "11111111-1111-4111-8111-111111111111";
const LILY = "22222222-2222-4222-8222-222222222222";
const BEN = "33333333-3333-4333-8333-333333333333";
const GRAN = "44444444-4444-4444-8444-444444444444";
const DAD = "55555555-5555-4555-8555-555555555555";
const FA = { kids: "2", prep: "open_and_go", budget: "unsure", approach: "unsure", frustration: "time", esa: "no" };
const session = (child: string, year: number, role: string, bank: string, observer: string | null = null, scores: Scores = NOW) => ({
  id: crypto.randomUUID(), family_id: FAM, child_id: child, rater_role: role, observer_id: observer, bank_version: bank, quiz_year: year,
  is_pilot_retake: false, completed_at: `${year}-08-0${role === "mom" ? 1 : 3}T12:00:00Z`, scores, top3: ["maker", "cultivator", "designer"],
  family_answers: role === "mom" ? FA : null,
});
function world(): Record<string, Row[]> {
  return {
    wired_families: [{ id: FAM, email: "mom@example.com", first_name: "Sarah" }],
    wired_children: [
      { id: LILY, family_id: FAM, nickname: "Lily", grade: 6, created_at: "2026-08-01T00:00:00Z", removed_at: null },
      { id: BEN, family_id: FAM, nickname: "Ben", grade: 2, created_at: "2027-08-01T00:00:00Z", removed_at: null },
    ],
    wired_unlocks: [{ id: "u1", family_id: FAM, child_id: LILY, product: "family_map", order_id: "o1" }, { id: "u2", family_id: FAM, child_id: BEN, product: "family_map", order_id: "o1" }],
    wired_family_prefs: [],
    wired_family_results: [],
    wired_results: [
      { child_id: LILY, quiz_year: 2027, blended_scores: NOW, top3: ["maker", "cultivator", "designer"], computed_at: "2027-08-03T12:00:00Z", renaissance: false, matches_snapshot: null },
      { child_id: LILY, quiz_year: 2026, blended_scores: LAST, top3: ["maker", "storyteller", "designer"], computed_at: "2026-08-03T12:00:00Z", renaissance: false, matches_snapshot: null },
      { child_id: BEN, quiz_year: 2027, blended_scores: NOW, top3: ["maker", "cultivator", "designer"], computed_at: "2027-08-03T12:00:00Z", renaissance: false, matches_snapshot: null },
    ],
    wired_sessions: [
      session(LILY, 2027, "mom", "g68-v1"), session(LILY, 2027, "observer", "g68-v1", GRAN), session(LILY, 2027, "observer", "g68-v1", DAD),
      session(LILY, 2026, "mom", "g35-v1", null, LAST), session(LILY, 2026, "observer", "g35-v1", GRAN, LAST),
      { ...session(LILY, 2026, "observer", "g35-v1", DAD, LAST), completed_at: null },                  // never finished: not counted
      { ...session(LILY, 2026, "mom", "g35-v1", null, LAST), is_pilot_retake: true },                  // a pilot retake: not counted
      session(BEN, 2027, "mom", "k2-v1"),
    ],
    wired_observers: [{ id: GRAN, family_id: FAM, child_id: LILY, label: "Grandparent" }, { id: DAD, family_id: FAM, child_id: LILY, label: "Dad" }],
    wired_question_banks: [
      { version: "k2-v1", set_kind: "k2" }, { version: "g35-v1", set_kind: "g3_5" }, { version: "g68-v1", set_kind: "g6_8" },
      { version: "g912-v1", set_kind: "g9_12" }, { version: "teen-v1", set_kind: "teen" }, { version: "adult-v1", set_kind: "adult" },
    ],
  };
}
const job = (over: Partial<PdfJob>): PdfJob => ({ id: "j1", family_id: FAM, child_id: null, order_id: "o1", buyer_id: null, kind: "family_map", quiz_year: 2027, attempts: 0, status: "queued", ...over });

Deno.test("yoy loader: the fake knows only real columns (it 400s on an invented one), read from the migrations", async () => {
  assert(COLS.wired_results.has("blended_scores") && COLS.wired_sessions.has("bank_version") && COLS.wired_question_banks.has("set_kind"));
  assert(COLS.wired_observers.has("quiz_year"), "add column from a later migration is picked up");
  assert(!COLS.wired_sessions.has("set_kind") && !COLS.wired_results.has("band") && !COLS.wired_results.has("family_id"));
  installDb(world());
  const r = await fetch(`${DB.url}/rest/v1/wired_results?child_id=eq.${LILY}&select=quiz_year,observer_count`);
  assertEquals(r.status, 400);
  const r2 = await fetch(`${DB.url}/rest/v1/wired_sessions?grade_band=eq.6-8&select=id`);
  assertEquals(r2.status, 400);
});

Deno.test("yoy loader: Family Map job loads the earlier year for a child who has one (scores, top 3, others, both bands), none for a child who doesn't", async () => {
  const seen = installDb(world());
  const loaded = await loadBlueprintData(DB, job({}));
  const [lily, ben] = loaded.children;
  assertEquals(lily.nickname, "Lily");
  assertEquals(lily.observerCount, 2);
  assertEquals(lily.questionBand, "6-8");
  assertEquals(lily.priorYear, { quizYear: 2026, scores: LAST, top3: ["maker", "storyteller", "designer"], otherCount: 1, band: "3-5" });
  assertEquals(ben.nickname, "Ben");
  assertEquals(ben.priorYear, undefined);
  assertEquals(ben.questionBand, undefined);

  // Filtered by child (and family where the table has it), the earlier year strictly before the year shown.
  const prior = seen.filter((s) => s.path.includes("quiz_year=lt."));
  assertEquals(prior.map((s) => s.path), [
    `wired_results?child_id=eq.${LILY}&quiz_year=lt.2027&select=quiz_year,blended_scores,top3&order=quiz_year.desc&limit=1`,
    `wired_results?child_id=eq.${BEN}&quiz_year=lt.2027&select=quiz_year,blended_scores,top3&order=quiz_year.desc&limit=1`,
  ]);
  const lastYearSessions = seen.filter((s) => s.path.startsWith("wired_sessions?") && s.path.includes("quiz_year=eq.2026"));
  assertEquals(lastYearSessions.length, 1);
  assertStringIncludes(lastYearSessions[0].path, `child_id=eq.${LILY}&family_id=eq.${FAM}`);
  assertStringIncludes(lastYearSessions[0].path, "completed_at=not.is.null&is_pilot_retake=eq.false&select=rater_role,bank_version");
  const banks = seen.filter((s) => s.path.startsWith("wired_question_banks?"));
  assertEquals(banks.map((s) => s.path), ["wired_question_banks?version=in.(g68-v1,g35-v1)&select=version,set_kind"]);

  // The rendered Family Map: Lily's page with her real numbers, nothing for Ben.
  const out = await renderJob(job({}), loaded);
  assert(out.bytes.length < 3 * 1024 * 1024);
  const all = flat((await pdfLines(out.bytes)).flat());
  assertStringIncludes(all, "How Lily has grown since last July");
  assertStringIncludes(all, "This year's results include 2 other people's answers and last year's included 1, so some differences come from the extra views.");
  assertStringIncludes(all, "This year you answered the grades 6-8 questions about Lily, and last year it was the grades 3-5 questions.");
  assert(!all.includes("How Ben has grown since last July"));
});

Deno.test("yoy loader: a Blueprint rebuilt at send time (job quiz_year 0) compares against the year BEFORE the latest results", async () => {
  installDb(world());
  const loaded = await loadBlueprintData(DB, job({ kind: "blueprint", child_id: LILY, order_id: null, quiz_year: 0 }));
  assertEquals(loaded.children[0].priorYear?.quizYear, 2026);
  const all = flat((await pdfLines((await renderJob(job({ kind: "blueprint", child_id: LILY }), loaded)).bytes)).flat());
  for (const s of expectedSentences(loaded.children[0])) assertStringIncludes(all, s);
});

Deno.test("yoy loader: no earlier year -> no extra session or bank reads; the free results PDF never reads one", async () => {
  const w = world();
  w.wired_results = w.wired_results.filter((r) => r.quiz_year === 2027);
  let seen = installDb(w);
  const one = await loadBlueprintData(DB, job({ kind: "blueprint", child_id: LILY, order_id: null }));
  assertEquals(one.children[0].priorYear, undefined);
  assertEquals(seen.filter((s) => s.path.includes("quiz_year=lt.")).length, 1);
  assert(!seen.some((s) => s.path.startsWith("wired_question_banks?")));
  assertEquals(seen.filter((s) => s.path.startsWith("wired_sessions?")).length, 1);

  seen = installDb(world());
  const free = await loadBlueprintData(DB, job({ kind: "free", child_id: LILY, order_id: null }));
  assertEquals(free.children[0].priorYear, undefined);
  assert(!seen.some((s) => s.path.includes("quiz_year=lt.") || s.path.startsWith("wired_question_banks?")));
});

Deno.test("yoy loader: last year's mom answered a set that is not a grade band, or the bank is gone -> no grade-set line", async () => {
  const w = world();
  w.wired_question_banks = w.wired_question_banks.filter((b) => b.version !== "g35-v1");
  installDb(w);
  const loaded = await loadBlueprintData(DB, job({ kind: "blueprint", child_id: LILY, order_id: null }));
  assertEquals(loaded.children[0].priorYear?.band, null);
  assertEquals(loaded.children[0].questionBand, "6-8");
  assertEquals(yearOverYear(loaded.children[0])!.grades, null);
});
