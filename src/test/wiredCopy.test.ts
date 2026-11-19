/**
 * Wired quiz W4: the words on /wired and /wired/results are Camila's APPROVED copy, word for word,
 * and never use the banned phrases (spec rule 1). Each string in web/lib/wiredCopy.ts and
 * web/lib/wiredWriteups.ts must appear in one of the approved files snapshotted in docs/wired-copy/.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  APPROACHES, COMING_SOON_912, FAMILY_INTRO, FAMILY_QUESTIONS, RANKING, REASONS, RESULTS, SCREENS, TIP_LABELS, TIPS, fill,
} from "../../web/lib/wiredCopy";
import { WIRING_WRITEUPS } from "../../web/lib/wiredWriteups";

const root = join(__dirname, "..", "..");
const approved = readdirSync(join(root, "docs", "wired-copy"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => readFileSync(join(root, "docs", "wired-copy", f), "utf8").replace(/\s+/g, " "))
  .join("\n");

/** Put the approved files' bracket placeholders back. */
function bracketed(s: string, nickname: "Nickname" | "nickname"): string {
  return s
    .replace(/\{name\}/g, `[${nickname}]`)
    .replace(/\{wiring\}/g, "[Wiring]")
    .replace(/\{approach\}/g, "[Approach]")
    .replace(/\{description\}/g, "[its one-line description]")
    .replace(/\{a\}/g, "[A]").replace(/\{b\}/g, "[B]").replace(/\{c\}/g, "[C]")
    .replace(/\{state\}/g, "[State]")
    .replace(/\s+/g, " ");
}
const isApproved = (s: string) => approved.includes(bracketed(s, "Nickname")) || approved.includes(bracketed(s, "nickname"));

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

const SHIPPED = [
  ...strings(RESULTS), ...strings(APPROACHES), ...strings(TIP_LABELS), ...strings(TIPS), ...strings(REASONS),
  FAMILY_INTRO, ...FAMILY_QUESTIONS.flatMap((q) => [q.question, q.helper ?? "", ...q.options.map((o) => o[1])]).filter(Boolean),
  ...strings(RANKING), ...strings(SCREENS),
  ...Object.values(WIRING_WRITEUPS).flatMap((w) => [w.short, w.bible, w.name]),
];

describe("wired copy is the approved copy, word for word", () => {
  it("every shipped string is in an approved file", () => {
    const missing = SHIPPED.filter((s) => !isApproved(s));
    expect(missing).toEqual([]);
  });

  it("the grades 9-12 coming-soon line is the approved 6-8 line with 'grades 9-12'", () => {
    expect(COMING_SOON_912).toContain("grades 9-12");
    expect(COMING_SOON_912.replace("grades 9-12", "grades 6-8")).toBe(RESULTS.comingSoon68);
  });

  it("fill() replaces only known placeholders", () => {
    expect(fill(RESULTS.heading, { name: "Lily" })).toBe("How God wired Lily");
    expect(fill("{name} {other}", { name: "Ben" })).toBe("Ben {other}");
  });
});

describe("rule 1: banned phrases never appear in any wired copy or wired UI file", () => {
  const BANNED = [/learning style/i, /learns best/i, /\bdiagnose/i, /assessment shows/i];
  const files = [
    "web/lib/wiredCopy.ts", "web/lib/wiredWriteups.ts", "web/lib/wiredApi.ts",
    ...readdirSync(join(root, "web", "components", "islands")).filter((f) => /^Wired/.test(f)).map((f) => `web/components/islands/${f}`),
    ...readdirSync(join(root, "web", "pages", "wired")).map((f) => `web/pages/wired/${f}`),
  ];
  it("covers the quiz files", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });
  for (const f of files) {
    it(f, () => {
      // Comments that QUOTE the rule are allowed; shipped text is what matters.
      const code = readFileSync(join(root, f), "utf8").replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const b of BANNED) expect(code).not.toMatch(b);
    });
  }
});
