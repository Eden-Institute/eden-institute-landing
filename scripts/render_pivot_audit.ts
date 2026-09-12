// Render every email template touched by the print-first pivot (2026-09-12) and
// fail if any rendered SUBJECT or HTML still carries kit, preorder, founding-500,
// card-deck or credit language, or an em dash. There was no render QA script in
// the repo (the comment in launch-sequence-templates.ts refers to one that never
// landed), so this is it. Run from the repo root:
//
//   deno run --allow-read scripts/render_pivot_audit.ts
//
// Exit 1 on any hit. Positions 13-17 are NOT rendered: they are the retired kit
// emails, kept verbatim for phase two, and are expected to mention the kit.
import { buildLaunchEmail } from "../supabase/functions/_shared/launch-sequence-templates.ts";
import {
  buildMagnetWeek3FacebookEmail,
  buildStarterOfferEmail,
} from "../supabase/functions/_shared/nurture-email-templates.ts";

const FORBIDDEN = [
  /\bkits?\b/i,
  /preorder/i,
  /founding/i,
  /\$349/,
  /first 500|the 500|500 kits|500 families/i,
  /card decks?/i,
  /field cards?/i,
  /recipe cards?/i,
  /around the table cards?/i,
  /\/preorder/i,
  /comes off/i,
  /—/, // em dash
];

let failures = 0;
function audit(label: string, built: { subject: string; html: string } | null) {
  if (!built) {
    console.log(`FAIL ${label}: builder returned null`);
    failures++;
    return;
  }
  // Strip the hidden preheader? No: it is part of what the inbox shows. Audit all of it.
  const text = built.subject + "\n" + built.html;
  const hits: string[] = [];
  for (const re of FORBIDDEN) {
    const m = text.match(re);
    if (m) {
      const i = text.search(re);
      hits.push(`${re}  …${text.slice(Math.max(0, i - 60), i + 60).replace(/\s+/g, " ")}…`);
    }
  }
  if (hits.length) {
    failures++;
    console.log(`FAIL ${label}  subject="${built.subject}"`);
    for (const h of hits) console.log(`     ${h}`);
  } else {
    console.log(`ok   ${label}  subject="${built.subject}"  (${built.html.length} chars)`);
  }
}

for (const pos of [8, 9, 10, 11, 12, 19, 20, 21]) {
  for (const founding of [true, false]) {
    audit(`launch ${pos} founding=${founding}`, buildLaunchEmail(pos, "Sarah", founding));
  }
}
for (const band of ["sprouts", "seedlings"] as const) {
  audit(`magnet 2 starter offer ${band}`, buildStarterOfferEmail("Sarah", band));
}
audit("magnet 3 facebook", buildMagnetWeek3FacebookEmail("Sarah"));

console.log(failures ? `\n${failures} template(s) FAILED` : "\nALL CLEAN");
Deno.exit(failures ? 1 : 0);
