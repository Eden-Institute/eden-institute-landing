// scripts/move-starter-credits-to-print.ts
//
// ONE-OFF, founder decision 2026-11-22 (rule 4). Moves every outstanding Sprouts
// Starter credit minted on the old kit-only coupon onto the Sprouts printed-set
// coupon: a new code per family, the old code retired (Stripe `active: false`).
// The logic, and its tests, live in supabase/functions/_shared/starter-credit-move.ts.
//
// DRY RUN IS THE DEFAULT. It only reads, and prints what it would do with emails
// and codes masked. Nothing is written without --apply AND --expect=<n>, where n is
// the number of moves the dry run printed.
//
// IT NEVER EMAILS ANYONE. The families are told by a separate, approved email.
//
// Run from the repo root:
//   deno run --allow-net --allow-env scripts/move-starter-credits-to-print.ts
//   deno run --allow-net --allow-env scripts/move-starter-credits-to-print.ts --apply --expect=6
// Options:
//   --skip-internal   leave any @edeninstitute.health credit where it is
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   STRIPE_STARTER_PROMO_KEY (preferred: the restricted key verified for promotion
//     codes, coupons, prices and products) or STRIPE_SECRET_KEY
//   STRIPE_STARTER_CREDIT_COUPON_ID              the legacy kit-only coupon
//   STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS   the new Sprouts printed-set coupon
// Optional:
//   STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS checked too, read-only, when set
//
// Exit codes: 0 done (or dry run printed), 1 something needs a human, 2 config error.

import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  applyStarterCreditMove,
  checkPrintCreditCoupon,
  describePlan,
  describeResults,
  planStarterCreditMove,
} from "../supabase/functions/_shared/starter-credit-move.ts";
import { LEGACY_KIT_CREDIT_COUPON_ENV, STARTER_BANDS } from "../supabase/functions/_shared/starter-config.ts";

function required(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    console.error(`Missing required env var ${name}`);
    Deno.exit(2);
  }
  return v;
}

const args = new Set(Deno.args.filter((a) => !a.startsWith("--expect")));
const apply = args.has("--apply");
const skipInternal = args.has("--skip-internal");
const expectArg = Deno.args.find((a) => a.startsWith("--expect="));
const expectCount = expectArg ? Number(expectArg.slice("--expect=".length)) : NaN;
for (const a of args) {
  if (!["--apply", "--skip-internal"].includes(a)) {
    console.error(`Unknown option ${a}`);
    Deno.exit(2);
  }
}
if (apply && !Number.isInteger(expectCount)) {
  console.error("--apply needs --expect=<n>, the number of moves the dry run printed.");
  Deno.exit(2);
}

const stripeKey = Deno.env.get("STRIPE_STARTER_PROMO_KEY") || required("STRIPE_SECRET_KEY");
const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia", httpClient: Stripe.createFetchHttpClient() });
const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
const sproutsEnv = STARTER_BANDS.sprouts.credit!.couponEnv;
const seedlingsEnv = STARTER_BANDS.seedlings.credit!.couponEnv;
const deps = {
  db,
  stripe,
  legacyCouponId: required(LEGACY_KIT_CREDIT_COUPON_ENV),
  newCouponId: required(sproutsEnv),
};

console.log(`Stripe mode: ${stripeKey.includes("_live_") ? "LIVE" : "TEST"}  (${Deno.env.get("STRIPE_STARTER_PROMO_KEY") ? "STRIPE_STARTER_PROMO_KEY" : "STRIPE_SECRET_KEY"})`);
console.log(apply ? `APPLY, expecting ${expectCount} move(s).` : "DRY RUN. Nothing will be written.");
console.log("");

// The coupons first: a code moved onto a mis-scoped coupon is a money leak.
const sproutsCheck = await checkPrintCreditCoupon({ db, stripe }, "sprouts", deps.newCouponId);
const checks = [sproutsCheck];
const seedlingsCoupon = Deno.env.get(seedlingsEnv);
if (seedlingsCoupon) checks.push(await checkPrintCreditCoupon({ db, stripe }, "seedlings", seedlingsCoupon));
else console.log(`${seedlingsEnv} is not set; the Seedlings coupon is not checked.`);
for (const c of checks) {
  console.log(`Coupon check, ${c.band} (${c.couponId}): ${c.ok ? "OK" : "PROBLEMS"}`);
  for (const e of c.expected) console.log(`  expects ${e.sku} -> ${e.productId ?? "(unresolved)"}`);
  console.log(`  coupon covers: ${c.couponProducts.join(", ") || "(nothing)"}`);
  for (const p of c.problems) console.log(`  PROBLEM: ${p}`);
}
console.log("");

const plan = await planStarterCreditMove(deps, { skipInternal });
for (const line of describePlan(plan)) console.log(line);
console.log("");

if (!apply) {
  console.log(`Dry run only. To apply: --apply --expect=${plan.moves}${skipInternal ? " --skip-internal" : ""}`);
  Deno.exit(sproutsCheck.ok ? 0 : 1);
}
if (!sproutsCheck.ok) {
  console.error("Refusing to apply: the Sprouts printed-set coupon failed its check (above).");
  Deno.exit(1);
}

const results = await applyStarterCreditMove(deps, plan, { expectCount });
for (const line of describeResults(results)) console.log(line);
const bad = results.filter((r) => !["moved", "finished_old_deactivation"].includes(r.status));
console.log("");
console.log(`${results.length - bad.length} done, ${bad.length} need a look. No email was sent.`);
Deno.exit(bad.length ? 1 : 0);
