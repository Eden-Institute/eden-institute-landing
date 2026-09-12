// Render the two free-week welcome emails and assert the card decks are gone.
// Founder instruction 2026-09-12: the free week no longer includes the Field,
// Recipe or Around the Table cards, either band.
//
//   deno run --allow-read scripts/render_freeweek_audit.ts
//
// resend-waitlist keeps its builders private, so this re-reads the source and
// checks the rendered download block rather than importing. Exit 1 on any hit.
const src = await Deno.readTextFile("supabase/functions/resend-waitlist/index.ts");

function block(fn: string): string {
  const i = src.indexOf(`function ${fn}(`);
  if (i < 0) throw new Error(`${fn} not found`);
  const j = src.indexOf("\nfunction ", i + 10);
  return src.slice(i, j < 0 ? src.length : j);
}

const FORBIDDEN = [/-fc-/, /-rc-/, /-att-/, /FIELD CARDS/i, /RECIPE CARDS/i, /AROUND THE TABLE/i];
const EXPECTED: Record<string, string[]> = {
  buildSproutsMagnetEmail: ["-ra-lavender.pdf", "-tg-lavender.pdf", "-nb-lavender.pdf"],
  buildSeedlingsMagnetEmail: ["-tg-elderberry.pdf", "-nb-elderberry.pdf"],
};

let failures = 0;
for (const [fn, wanted] of Object.entries(EXPECTED)) {
  const b = block(fn);
  const bad = FORBIDDEN.filter((re) => re.test(b));
  const missing = wanted.filter((w) => !b.includes(w));
  const count = (b.match(/ctaButton\(/g) ?? []).length;
  if (bad.length || missing.length || count !== wanted.length) {
    failures++;
    console.log(`FAIL ${fn}: ${count} buttons (want ${wanted.length})`);
    if (bad.length) console.log(`     card refs still present: ${bad.join(", ")}`);
    if (missing.length) console.log(`     missing: ${missing.join(", ")}`);
  } else {
    console.log(`ok   ${fn}: ${count} downloads, no card decks`);
  }
}

// The label above the buttons must agree with how many there are.
for (const [fn, wanted] of Object.entries(EXPECTED)) {
  const b = block(fn);
  const word = wanted.length === 3 ? "THREE" : "TWO";
  if (!b.includes(`YOUR ${word} DOWNLOADS`)) {
    failures++;
    console.log(`FAIL ${fn}: download-count label does not say ${word}`);
  } else {
    console.log(`ok   ${fn}: label says ${word}`);
  }
}

// The fallback signup source must not route to the Founders Club preorder email.
const wc = await Deno.readTextFile("web/components/islands/WaitlistController.tsx");
if (/useState<Cfg>\(\{ title: "", source: "reserve" \}\)/.test(wc)) {
  failures++;
  console.log('FAIL WaitlistController still falls back to source "reserve"');
} else {
  console.log("ok   WaitlistController fallback is not reserve");
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CLEAN");
Deno.exit(failures ? 1 : 0);
