// Vercel cron wiring for the founder reports and their retry passes.
//   1. Every /api/cron path in vercel.json has a handler file, and every handler
//      file declares the edge runtime (a Web Request handler without it runs on
//      the Node runtime and fails).
//   2. Each report's retry pass runs exactly 37 minutes after its main run, on the
//      same days, and re-exports the main handler (so the Edge Function's run claim
//      decides whether anything is sent).

import { describe, expect, it } from "vitest";
import vercelJsonRaw from "../../vercel.json?raw";

const handlers = import.meta.glob("../../api/cron/*.ts", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const crons = (JSON.parse(vercelJsonRaw) as { crons: Array<{ path: string; schedule: string }> }).crons;
const byPath = new Map(crons.map((c) => [c.path, c.schedule]));
const source = (name: string) => handlers[`../../api/cron/${name}.ts`];

describe("api/cron handlers", () => {
  it("finds the handler files", () => {
    expect(Object.keys(handlers).length).toBeGreaterThanOrEqual(13);
  });

  it("every handler declares the edge runtime", () => {
    for (const [file, text] of Object.entries(handlers)) {
      expect(text, file).toMatch(/export const config = \{ runtime: 'edge' \};/);
    }
  });

  it("every scheduled path has a handler file", () => {
    for (const c of crons) {
      expect(c.path).toMatch(/^\/api\/cron\/[a-z0-9-]+$/);
      expect(source(c.path.replace("/api/cron/", "")), c.path).toBeTypeOf("string");
    }
  });
});

describe("report retry passes", () => {
  const pairs = [
    ["notify-founder-digest", "notify-founder-digest-retry"],
    ["weekly-trends-digest", "weekly-trends-digest-retry"],
    ["founder-evening-recap", "founder-evening-recap-retry"],
  ] as const;

  for (const [main, retry] of pairs) {
    it(`${retry} runs 37 minutes after ${main} on the same days`, () => {
      const m = byPath.get(`/api/cron/${main}`)?.split(" ");
      const r = byPath.get(`/api/cron/${retry}`)?.split(" ");
      expect(m, main).toBeDefined();
      expect(r, retry).toBeDefined();
      expect(Number(r![0])).toBe(Number(m![0]) + 37);
      expect(r!.slice(1)).toEqual(m!.slice(1));
    });

    it(`${retry} re-exports the ${main} handler`, () => {
      expect(source(retry)).toContain(`import handler from './${main}';`);
      expect(source(retry)).toContain("export default handler;");
    });
  }

  it("keeps the verified schedules", () => {
    expect(byPath.get("/api/cron/weekly-trends-digest-retry")).toBe("37 14 * * 5");
    expect(byPath.get("/api/cron/founder-evening-recap-retry")).toBe("37 1 * * *");
  });
});
