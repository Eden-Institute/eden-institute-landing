// web/lib/onlineYearPortfolio.ts
//
// "[Child]'s portfolio" and the year-end certificate (Online Year OY7, punch #472), built in the browser from the
// done log (online-year-family 'progress') and the book data the site already carries: plants
// (scopeAndSequence.ts), each week's Scripture and the band's standards (onlineYearContent.ts, read from the
// printed books). Unit tested in src/test/onlineYearPortfolio.test.ts.
//
// Approved words used (plan "Approved copy > Inside the reader", Nov 23):
//   Portfolio: "[Child]'s portfolio: week, date finished, plant, Scripture, plus the standards the year is aligned to."
//   Certificate: "[Child] finished the Sprouts year of Eden's Table and learned [number] plants. [school year]"
// The column headings are those same four words. The certificate page is added once the year is finished:
// all 36 weeks marked done, or the license's year has ended.

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { OY_APPROVED, type OnlineYearBandKey } from "./onlineYearCopy";
import { STANDARDS, WEEK_SCRIPTURE } from "./onlineYearContent";
import { plantFor } from "./onlineYearReader";

export interface DoneWeek {
  week: number;
  done_on: string; // YYYY-MM-DD (Central)
}
export interface PortfolioInput {
  child: string;
  band: OnlineYearBandKey;
  starts_at: string;
  ends_at: string;
  done: DoneWeek[];
  now?: Date;
}
export interface PortfolioRow {
  week: number;
  date: string;
  plant: string;
  scripture: string;
}

const BAND_NAME: Record<OnlineYearBandKey, string> = { sprouts: "Sprouts", seedlings: "Seedlings" };

/** "December 1, 2026" from a YYYY-MM-DD date (no time zone shift: it is already a Central date). */
export function longDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

/** "2026-2027" from the license's start and end (Central years). */
export function schoolYear(startsAt: string, endsAt: string): string {
  const y = (iso: string) => Number(new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago", year: "numeric" }));
  const a = y(startsAt), b = y(endsAt);
  return a === b ? String(a) : `${a}-${b}`;
}

export function portfolioRows(band: OnlineYearBandKey, done: DoneWeek[]): PortfolioRow[] {
  return [...done]
    .filter((d) => Number.isInteger(d.week) && d.week >= 1 && d.week <= 36)
    .sort((a, b) => a.week - b.week)
    .map((d) => {
      const s = WEEK_SCRIPTURE[band][d.week];
      return { week: d.week, date: longDate(d.done_on), plant: plantFor(band, d.week), scripture: s ? `${s.ref}: ${s.verse}` : "" };
    });
}

/** The certificate is earned when all 36 weeks are done, or the year has ended. */
export function yearFinished(input: PortfolioInput): boolean {
  const weeks = new Set(input.done.map((d) => d.week));
  return weeks.size >= 36 || Date.parse(input.ends_at) <= (input.now ?? new Date()).getTime();
}

export function portfolioIntro(child: string): string {
  return `${child}'s portfolio: week, date finished, plant, Scripture, plus the standards the year is aligned to.`;
}

export function certificateLine(input: PortfolioInput): string {
  const plants = new Set(input.done.map((d) => d.week)).size;
  return `${input.child} finished the ${BAND_NAME[input.band]} year of Eden's Table and learned ${plants} plants. ${schoolYear(input.starts_at, input.ends_at)}`;
}

/** Keep only what the standard PDF font can draw (accents fall back to their base letter). */
function encodable(font: PDFFont, text: string): string {
  const ok = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of text.normalize("NFC")) {
    if (ok.has(ch.codePointAt(0)!)) out += ch;
    else {
      const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      out += base && [...base].every((c) => ok.has(c.codePointAt(0)!)) ? base : "?";
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const words = encodable(font, text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const INK = rgb(0.17, 0.16, 0.15);
const FOREST = rgb(0.18, 0.24, 0.2);
const SOFT = rgb(0.37, 0.35, 0.31);

export async function makePortfolioPdf(input: PortfolioInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.child}'s portfolio`);
  doc.setCreator("The Eden Institute");
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const W = 612, H = 792, M = 54; // US Letter, 3/4 inch margins
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const text = (t: string, size: number, font: PDFFont, color = INK, x = M, width = W - 2 * M, gap = 1.3) => {
    for (const line of wrap(font, t, size, width)) {
      if (y - size < M) newPage();
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= size * gap;
    }
  };

  text(`${input.child}'s portfolio`, 24, bold, FOREST);
  y -= 4;
  text(`Eden's Table · ${OY_APPROVED.bandLabel[input.band]} · ${schoolYear(input.starts_at, input.ends_at)}`, 12, serif, SOFT);
  y -= 8;
  text(portfolioIntro(input.child), 11, serif, SOFT);
  y -= 12;

  // The log: Week | Date finished | Plant, then the week's Scripture under it.
  const cols = [M, M + 50, M + 190];
  const head = (labels: string[]) => {
    if (y - 14 < M) newPage();
    labels.forEach((l, i) => page.drawText(l, { x: cols[i], y: y - 11, size: 11, font: bold, color: FOREST }));
    y -= 18;
  };
  head(["Week", "Date finished", "Plant"]);
  const rows = portfolioRows(input.band, input.done);
  for (const r of rows) {
    if (y - 40 < M) {
      newPage();
      head(["Week", "Date finished", "Plant"]);
    }
    page.drawText(String(r.week), { x: cols[0], y: y - 11, size: 11, font: serif, color: INK });
    page.drawText(encodable(serif, r.date), { x: cols[1], y: y - 11, size: 11, font: serif, color: INK });
    page.drawText(encodable(serif, r.plant), { x: cols[2], y: y - 11, size: 11, font: bold, color: INK });
    y -= 15;
    text(`Scripture: ${r.scripture}`, 9.5, serif, SOFT, cols[2], W - M - cols[2], 1.25);
    y -= 6;
  }

  // The standards the year is aligned to (the Teacher's Guide back matter).
  newPage();
  text("Standards the year is aligned to", 16, bold, FOREST);
  y -= 6;
  for (const g of STANDARDS[input.band]) {
    y -= 4;
    text(g.heading, 10.5, bold, FOREST);
    for (const it of g.items) text(`${it.code}  ${it.text}`, 9, serif, INK, M + 10, W - 2 * M - 10, 1.25);
    for (const n of g.notes) text(n, 9, serif, SOFT, M + 10, W - 2 * M - 10, 1.25);
  }

  if (yearFinished(input)) {
    newPage();
    // Only the approved certificate line, set large: no heading words she has not approved.
    y = H / 2 + 60;
    text(certificateLine(input), 22, bold, FOREST, M, W - 2 * M, 1.4);
  }
  return doc.save();
}
