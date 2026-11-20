import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cleanChildIds, planCents, planWiredCart, wiredOrderLabel, WIRED_CHECKOUT_SUBMIT_MESSAGE } from "./wired-checkout.ts";

const keys = (r: ReturnType<typeof planWiredCart>) => r.ok ? r.plan.lines.map((l) => `${l.lookup_key}x${l.quantity}`) : r.error;

Deno.test("Blueprint: one child, $19, unlocks as blueprint", () => {
  const r = planWiredCart({ product: "blueprint", childCount: 1 });
  assertEquals(keys(r), ["wired_blueprintx1"]);
  if (r.ok) { assertEquals(planCents(r.plan), 1900); assertEquals(r.plan.unlockAs, "blueprint"); assertEquals(r.plan.orderLookupKey, "wired_blueprint"); }
  assertEquals(keys(planWiredCart({ product: "blueprint", childCount: 2 })), "blueprint_is_one_child");
});

Deno.test("Family Map: $47 up to 5, +$10 per child after", () => {
  const five = planWiredCart({ product: "family_map", childCount: 5 });
  assertEquals(keys(five), ["wired_family_mapx1"]);
  if (five.ok) assertEquals(planCents(five.plan), 4700);
  const seven = planWiredCart({ product: "family_map", childCount: 7 });
  assertEquals(keys(seven), ["wired_family_mapx1", "wired_extra_childx2"]);
  if (seven.ok) { assertEquals(planCents(seven.plan), 6700); assertEquals(seven.plan.extraChildren, 2); assertEquals(seven.plan.unlockAs, "family_map"); }
});

Deno.test("Checkout upsell: Blueprint + upgrade = $47, same as the Family Map", () => {
  const r = planWiredCart({ product: "blueprint_upgrade", childCount: 3 });
  assertEquals(keys(r), ["wired_blueprintx1", "wired_family_map_upgradex1"]);
  if (r.ok) { assertEquals(planCents(r.plan), 4700); assertEquals(r.plan.unlockAs, "family_map"); }
  const six = planWiredCart({ product: "blueprint_upgrade", childCount: 6 });
  if (six.ok) assertEquals(planCents(six.plan), 5700);
});

Deno.test("Later $28 upgrade needs a same-year Blueprint", () => {
  assertEquals(keys(planWiredCart({ product: "family_map_upgrade", childCount: 2 })), "upgrade_needs_blueprint");
  assertEquals(keys(planWiredCart({ product: "family_map_upgrade", childCount: 2, hasSameYearBlueprint: false })), "upgrade_needs_blueprint");
  const ok = planWiredCart({ product: "family_map_upgrade", childCount: 6, hasSameYearBlueprint: true });
  assertEquals(keys(ok), ["wired_family_map_upgradex1", "wired_extra_childx1"]);
  if (ok.ok) assertEquals(planCents(ok.plan), 3800);
});

Deno.test("Bad input is refused", () => {
  assertEquals(keys(planWiredCart({ product: "free", childCount: 1 })), "unknown_product");
  assertEquals(keys(planWiredCart({ product: "family_map", childCount: 0 })), "no_children");
  assertEquals(keys(planWiredCart({ product: "family_map", childCount: 16 })), "too_many_children");
  assertEquals(keys(planWiredCart({ product: "family_map", childCount: 1.5 })), "no_children");
});

Deno.test("cleanChildIds: uuids only, de-duplicated, lower-cased", () => {
  const a = "0f8fad5b-d9cb-469f-a165-70867728950e";
  assertEquals(cleanChildIds([a, a.toUpperCase()]), [a]);
  assertEquals(cleanChildIds([a, "x"]), null);
  assertEquals(cleanChildIds("x"), null);
  assertEquals(cleanChildIds([]), []);
});

Deno.test("Order labels and the all-sales-final text", () => {
  assertEquals(wiredOrderLabel("wired_family_map"), "Family Learning Map");
  assertEquals(wiredOrderLabel("wired_family_map", 1), "Family Learning Map + 1 extra child");
  assertEquals(wiredOrderLabel("wired_blueprint_upgrade", 2), "Learner Blueprint + Family Map upgrade + 2 extra children");
  assertEquals(/all sales are final/.test(WIRED_CHECKOUT_SUBMIT_MESSAGE), true);
});
