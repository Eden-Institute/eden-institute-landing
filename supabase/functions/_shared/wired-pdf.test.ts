import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bandOf, buildBlueprintPdf, buildFamilyMapPdf, lowest3, pairBlurb, reasonLines, sharedWirings, type BlueprintData } from "./wired-pdf.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const scores = { storyteller: 40, organizer: 30, designer: 85, maker: 90, psalmist: 20, connector: 50, ponderer: 10, cultivator: 70, seeker: 5 };
export const lily: BlueprintData = {
  nickname: "Lily", grade: 2, scores, top3: ["maker", "designer", "cultivator"], answeredOn: new Date("2026-11-19T18:00:00Z"), observerCount: 0,
  matches: [
    { name: "Beautiful Feet Books", link: "https://example.com/bf", isAffiliate: true, subjects: ["History and geography", "Language arts"], because: ["Serves 2 of Lily's top 3: Maker and Designer"] },
    { name: "Math-U-See", link: "https://example.com/mus", isAffiliate: false, subjects: ["Math"], because: ["Free"] },
  ],
  comingSoonBand: null, now: new Date("2026-11-19T18:00:00Z"),
};

Deno.test("helpers: band, lowest 3, pair blurb in domain order", () => {
  assertEquals([bandOf(0), bandOf(2), bandOf(3), bandOf(8), bandOf(12)], ["K-2", "K-2", "3-5", "6-8", "9-12"]);
  assertEquals(lowest3(scores), ["seeker", "ponderer", "psalmist"]);
  assert(pairBlurb(["maker", "designer"])!.startsWith("Pictures and hands") || pairBlurb(["maker", "designer"])!.length > 20);
  assertEquals(pairBlurb(["maker", "designer"]), pairBlurb(["designer", "maker"]));
});

Deno.test("reason lines use the approved wording", () => {
  const lines = reasonLines({ because: ["wiring", "prep", "budget"], served_top3: ["maker", "designer"], components: { prep: 0.5, budget: 1 }, price_cents: 0, prep_load: "light" }, "Lily", ["maker", "designer", "cultivator"]);
  assertEquals(lines, ["Serves 2 of Lily's top 3: Maker and Designer", "Light prep: about 10 to 20 minutes a day (a little more prep than you said you have)", "Free"]);
});

Deno.test("shared wirings need 2+ children", () => {
  const ben = { ...lily, nickname: "Ben", top3: ["maker", "storyteller", "seeker"] as BlueprintData["top3"] };
  assertEquals(sharedWirings([lily, ben]), [{ wiring: "maker", names: ["Lily", "Ben"] }]);
});

Deno.test("Blueprint renders under the 3 MB budget", async () => {
  const bytes = await buildBlueprintPdf(lily);
  const doc = await PDFDocument.load(bytes);
  assert(bytes.length < 3 * 1024 * 1024, `size ${bytes.length}`);
  assert(doc.getPageCount() >= 12, `pages ${doc.getPageCount()}`);
  if (Deno.env.get("WIRED_PDF_OUT")) await Deno.writeFile(`${Deno.env.get("WIRED_PDF_OUT")}/blueprint.pdf`, bytes);
});

Deno.test("Family Map with 6 children stays under budget", async () => {
  const names = ["Lily", "Ben", "Ana", "Sam", "Joy", "Eli"];
  const kids = names.map((n, i) => ({ ...lily, nickname: n, grade: i * 2, top3: (i % 2 ? ["maker", "storyteller", "seeker"] : ["designer", "maker", "cultivator"]) as BlueprintData["top3"], comingSoonBand: i * 2 >= 9 ? "9-12" as const : i * 2 >= 6 ? "6-8" as const : null }));
  const bytes = await buildFamilyMapPdf({ children: kids, now: lily.now });
  assert(bytes.length < 3 * 1024 * 1024, `size ${bytes.length}`);
  if (Deno.env.get("WIRED_PDF_OUT")) await Deno.writeFile(`${Deno.env.get("WIRED_PDF_OUT")}/familymap.pdf`, bytes);
  console.log("family map bytes", bytes.length, "pages", (await PDFDocument.load(bytes)).getPageCount());
});

Deno.test("Free results PDF renders small, with every approach code mapped to approved copy", async () => {
  const { buildFreeResultsPdf, APPROACH_COPY } = await import("./wired-pdf.ts");
  for (const c of ["charlotte_mason", "classical", "traditional", "unit_study", "literature", "montessori", "waldorf", "eclectic"]) assert(APPROACH_COPY[c]?.description, c);
  const bytes = await buildFreeResultsPdf({ ...lily, renaissance: false, tipFirst: "low_prep", approach: { fits: [{ approach: "unit_study", room_for: ["maker", "designer"] }], already_there: false, her_approach: "charlotte_mason" } });
  assert(bytes.length < 1024 * 1024, `size ${bytes.length}`);
  if (Deno.env.get("WIRED_PDF_OUT")) await Deno.writeFile(`${Deno.env.get("WIRED_PDF_OUT")}/free.pdf`, bytes);
});
