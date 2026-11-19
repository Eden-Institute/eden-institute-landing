// Fearfully & Wonderfully Wired, W5: turn the curriculum workbook (Wired_Quiz_Curriculum_Database.xlsx,
// tabs "Curricula" and "ESA by state", saved as CSV) into the rows wired_admin_import() takes.
// Pure: no I/O. Used by the founder admin page's import and by Lane 2's one-time import.
//
// Rules: the header row is found by its column names (the workbook has a colour-key line above it);
// a FORMAT EXAMPLE row (row_status "EXAMPLE") and any row Camila marked "Reject" are left out;
// everything else comes in UNAPPROVED (the database also refuses to change an approved row).

export interface CurriculumRow {
  sheet_id: string; name: string; publisher?: string; url?: string; approach?: string; subjects?: string[];
  grade_min?: number | null; grade_max?: number | null; domains_served?: string[]; prep_load?: string;
  price_cents?: number | null; price_basis?: string; multi_age?: boolean; faith_alignment?: string;
  affiliate_url?: string; is_affiliate?: boolean; eden_band?: string; coming_soon?: boolean; last_verified_at?: string;
  dm_name?: string; dm_role?: string; dm_email?: string; dm_source_url?: string;
}
export interface EsaImportRow { sheet_id: string; state: string; program: string; eligible: "yes" | "no" | "unknown"; verified_at?: string; source_url?: string; notes?: string }

/** RFC 4180-ish CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function table(text: string, must: string[]): Record<string, string>[] {
  const rows = parseCsv(text);
  const h = rows.findIndex((r) => must.every((m) => r.map((c) => c.trim()).includes(m)));
  if (h < 0) throw new Error(`could not find the header row (needs columns ${must.join(", ")})`);
  const head = rows[h].map((c) => c.trim());
  return rows.slice(h + 1).map((r) => Object.fromEntries(head.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const yes = (v: string) => /^(yes|y|true|1)$/i.test(v.trim());
const list = (v: string, lower = false) => v.split(/[;\n]/).map((x) => (lower ? x.trim().toLowerCase() : x.trim())).filter(Boolean);
function grade(v: string): number | null {
  const t = v.trim().toUpperCase();
  if (t === "") return null; // a blank cell is unknown, never kindergarten (Number("") is 0)
  if (t === "K" || t === "0") return 0;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= 12 ? n : null;
}
function cents(v: string): number | null {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
const opt = (v: string) => (v.trim() ? v.trim() : undefined);
function isoDate(v: string): string | undefined {
  const t = v.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : undefined;
}
const skip = (r: Record<string, string>) => /^example$/i.test(r.row_status ?? "") || /^reject$/i.test(r.camila_decision ?? "");

export function mapCurricula(csv: string): { rows: CurriculumRow[]; skipped: number } {
  const all = table(csv, ["curriculum_id", "name"]);
  const rows: CurriculumRow[] = [];
  let skipped = 0;
  for (const r of all) {
    if (skip(r) || !r.curriculum_id || !r.name) { skipped++; continue; }
    rows.push({
      sheet_id: r.curriculum_id, name: r.name, publisher: opt(r.publisher ?? ""), url: opt(r.product_url ?? ""),
      approach: opt(r.approach ?? ""), subjects: list(r.subjects ?? ""),
      grade_min: grade(r.grade_min ?? ""), grade_max: grade(r.grade_max ?? ""),
      // "Open-and-go (about 0-10 min of parent prep a day)" -> "Open-and-go": the level name only.
      domains_served: list(r.domains_served ?? "", true), prep_load: opt((r.prep_load ?? "").split("(")[0]),
      price_cents: cents(r.price_usd ?? ""), price_basis: opt(r.price_basis ?? ""), multi_age: yes(r.multi_age ?? ""),
      faith_alignment: opt(r.faith_alignment ?? ""), affiliate_url: opt(r.affiliate_url ?? ""), is_affiliate: yes(r.is_affiliate ?? ""),
      eden_band: opt(r.eden_band ?? ""), coming_soon: yes(r.coming_soon ?? ""), last_verified_at: isoDate(r.last_verified_date ?? ""),
      dm_name: opt(r.dm_name ?? ""), dm_role: opt(r.dm_role ?? ""), dm_email: opt(r.dm_email ?? ""), dm_source_url: opt(r.dm_source_url ?? ""),
    });
  }
  return { rows, skipped };
}

export function mapEsa(csv: string): { rows: EsaImportRow[]; skipped: number } {
  const all = table(csv, ["curriculum_id", "state", "program", "eligible"]);
  const rows: EsaImportRow[] = [];
  let skipped = 0;
  for (const r of all) {
    const e = (r.eligible ?? "").trim().toLowerCase();
    if (skip(r) || !r.curriculum_id || !r.state || !r.program) { skipped++; continue; }
    rows.push({
      sheet_id: r.curriculum_id, state: r.state.toUpperCase(), program: r.program,
      eligible: e === "yes" ? "yes" : e === "no" ? "no" : "unknown",
      verified_at: isoDate(r.verified_date ?? ""), source_url: opt(r.source_url ?? ""), notes: opt(r.notes ?? ""),
    });
  }
  return { rows, skipped };
}
