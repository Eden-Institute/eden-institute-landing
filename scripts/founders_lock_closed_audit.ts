// Assert the founders-lock reservation path is closed.
//
//   deno run --allow-read scripts/founders_lock_closed_audit.ts
//
// Closed 2026-09-12 with the print-first pivot. This fails the moment somebody
// re-opens the POST, un-gates an admin send action, or puts the reservation form
// back on the hosted page, without also flipping CLOSED.
const ef = await Deno.readTextFile("supabase/functions/founders-lock/index.ts");
const page = await Deno.readTextFile("public/sprouts-founders.html");

let failures = 0;
const check = (ok: boolean, label: string, detail = "") => {
  if (ok) console.log(`ok   ${label}`);
  else {
    failures++;
    console.log(`FAIL ${label}${detail ? "  " + detail : ""}`);
  }
};

check(/^const CLOSED = true;$/m.test(ef), "CLOSED flag is true");

// The POST gate must sit before the body is parsed, so no row can be written.
const postAt = ef.indexOf("if (req.method === 'POST') {");
const gateAt = ef.indexOf("error: 'preorders_closed'", postAt);
const bodyAt = ef.indexOf("req.json()", postAt);
check(postAt >= 0 && gateAt > postAt && gateAt < bodyAt,
  "POST refuses before reading the body");

for (const action of ["testsend", "send"]) {
  const i = ef.indexOf(`if (action === '${action}')`);
  const seg = ef.slice(i, i + 400);
  check(i >= 0 && seg.includes("preorders_closed"), `admin '${action}' is gated`);
}

// The hosted page must carry no form, no reservation button and no live claim.
// Checked against the page with HTML comments stripped: the comment at the top
// quotes the old copy on purpose, so phase two knows what it is restoring.
const visible = page.replace(/<!--[\s\S]*?-->/g, "");
check(!/<form/i.test(visible), "hosted page has no form");
check(!/Preorders are open/i.test(visible), "hosted page does not say preorders are open");
check(!/Lock in my/i.test(visible), "hosted page has no reserve button");
check(!/founders-lock/.test(visible), "hosted page posts nothing to the edge function");
check(/edeninstitute\.health\/books/.test(page), "hosted page points at /books");
check(/noindex/.test(page), "hosted page is noindex");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CLEAN");
Deno.exit(failures ? 1 : 0);
