// wired-teen-link: mom gets a private link for her teen's own side of the quiz (Fearfully & Wonderfully
// Wired, W9; spec 7.3, answers 23 and 28d). Public POST {token, child_id, age}, DARK until WIRED_ENABLED.
// verify_jwt = false (config.toml).
//
// Rules: grade 9-12 only (the teen set), the child must be unlocked, and mom picks her teen's age from a
// neutral list of 10 to 18 (FTC COPPA FAQ H.3): 13 or older gets a link; under 13 gets { under_13: true }
// and no link (the page shows the approved "ages 13 and up" line). No teen name or email is asked or stored.
// The code is shown once and only its SHA-256 is kept; single use, 60 days (_shared/wired-raters.ts).

import { familyChildRequest } from "../_shared/wired-family-auth.ts";
import { mintTeenLink } from "../_shared/wired-raters.ts";
import { wiredJson } from "../_shared/wired-gate.ts";

const SITE = "https://edeninstitute.health";

Deno.serve(async (req) => {
  const r = await familyChildRequest(req, "wired-teen-link");
  if (r instanceof Response) return r;
  const age = typeof r.body.age === "number" ? r.body.age : Number(r.body.age);
  if (!Number.isInteger(age) || age < 10 || age > 18) return wiredJson(400, { error: "age must be 10 to 18" });
  if (r.child.grade < 9) return wiredJson(400, { error: "teen_set_is_grades_9_12" });
  if (r.child.unlocked_via === null) return wiredJson(403, { error: "child_locked" });
  if (age < 13) return wiredJson(200, { under_13: true });
  try {
    const code = await mintTeenLink(r.db, r.child.id);
    return wiredJson(200, { url: `${SITE}/wired/teen?c=${code}` });
  } catch (err) {
    console.error("wired-teen-link:", err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: "could_not_make_link" });
  }
});
