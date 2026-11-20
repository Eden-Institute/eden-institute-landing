// Renders the Learner Blueprint for a neutral sample child ("Sam", grade 3) once per wiring, so the
// em-4 email can show a REAL Blueprint page (the Math page for that wiring), never an AI image.
// Run: deno run -A scripts/wired/render_em4_pages.ts <outDir>   then scripts/wired/em4_pdf_to_png.py
import { buildBlueprintPdf } from "../../supabase/functions/_shared/wired-pdf.ts";
import { DOMAINS } from "../../supabase/functions/_shared/wired-engine.ts";

const out = Deno.args[0] ?? ".";
for (const d of DOMAINS) {
  const scores = Object.fromEntries(DOMAINS.map((x) => [x, x === d ? 90 : 50])) as Record<string, number>;
  const bytes = await buildBlueprintPdf({
    nickname: "Sam", grade: 3, scores: scores as never, top3: [d] as never, answeredOn: new Date("2026-11-20T12:00:00Z"),
    observerCount: 0, matches: [], comingSoonBand: null, now: new Date("2026-11-20T12:00:00Z"),
  });
  await Deno.writeFile(`${out}/blueprint-${d}.pdf`, bytes);
  console.log(d, bytes.length);
}
