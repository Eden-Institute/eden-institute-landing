// Render every email template touched by the print-first pivot as READABLE PLAIN
// TEXT, for the founder to proofread. Not a test: render_pivot_audit.ts is the
// test. This one just prints the words.
//
//   deno run --allow-read scripts/render_pivot_copy.ts > copy.md
import { buildLaunchEmail } from "../supabase/functions/_shared/launch-sequence-templates.ts";
import {
  buildMagnetWeek3FacebookEmail,
  buildStarterOfferEmail,
} from "../supabase/functions/_shared/nurture-email-templates.ts";

function toText(html: string): string {
  return html
    // drop the hidden preheader div entirely, we print it separately
    .replace(/<div style="display:none[\s\S]*?<\/div>/g, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 [$1]")
    .replace(/<\/(p|div|tr|table|h1|h2|h3|blockquote|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&mdash;/g, "--")
    .replace(/&ndash;/g, "-")
    .replace(/&rarr;/g, "->")
    .replace(/&amp;/g, "&")
    .replace(/&oacute;/g, "ó")
    .replace(/&hellip;/g, "...")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n\n");
}

function preheaderOf(html: string): string {
  const m = html.match(/<div style="display:none[^>]*>([\s\S]*?)<\/div>/);
  return m ? m[1].replace(/&rsquo;/g, "’").replace(/&[a-z]+;/g, " ").trim() : "";
}

function show(label: string, built: { subject: string; html: string } | null) {
  if (!built) {
    console.log(`\n## ${label}\n\n(builder returned null)\n`);
    return;
  }
  console.log(`\n---\n\n## ${label}`);
  console.log(`\n**Subject:** ${built.subject}`);
  const pre = preheaderOf(built.html);
  if (pre) console.log(`\n**Inbox preview line:** ${pre}`);
  let body = toText(built.html);
  // Trim the shared wrapper so only the body shows: the gold header above, and
  // everything from the signature down (footer, socials, unsubscribe). None of
  // that changed in the pivot.
  const top = body.indexOf("Back to Eden. Back to Truth.");
  if (top >= 0) body = body.slice(top + "Back to Eden. Back to Truth.".length).trimStart();
  const sig = body.indexOf("Grace and health,");
  if (sig > 0) body = body.slice(0, sig).trimEnd();
  console.log("\n" + body + "\n");
}

console.log("# Print-first pivot: the new email copy, as it will send\n");
console.log("Rendered 2026-09-12 from the PR #475 branch. Footers and the signature block are");
console.log("unchanged and are trimmed out of these renders, so what is below is the body only.\n");

console.log("\n# The five rewritten conversion emails (launch 8 to 12)\n");
console.log("These went out on days 0, 2, 4, 7 and 10 after signup and sold the kit. Same days,");
console.log("same arc. The product is now the printed year.\n");
for (const pos of [8, 9, 10, 11, 12]) {
  show(`Launch ${pos}`, buildLaunchEmail(pos, "Sarah", true));
}

console.log("\n# The Starter arc (launch 19 to 21): price lines only\n");
for (const pos of [19, 20, 21]) {
  show(`Launch ${pos}`, buildLaunchEmail(pos, "Sarah", true));
}

console.log("\n# Free-week follow-ups\n");
show("Free week, follow-up 2 (Sprouts)", buildStarterOfferEmail("Sarah", "sprouts"));
show("Free week, follow-up 2 (Seedlings)", buildStarterOfferEmail("Sarah", "seedlings"));
show("Free week, follow-up 3", buildMagnetWeek3FacebookEmail("Sarah"));
