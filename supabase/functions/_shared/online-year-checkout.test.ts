import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildOnlineYearMetadata,
  cleanChildName,
  onlineYearPlanCents,
  onlineYearProductDescription,
  onlineYearProductName,
  planOnlineYearCart,
  readOnlineYearMetadata,
} from "./online-year-checkout.ts";
import { onlineYearOpen } from "./online-year-gate.ts";

const lines = (r: ReturnType<typeof planOnlineYearCart>) => r.ok ? r.plan.lines.map((l) => `${l.lookup_key}x${l.quantity}`) : r.error;
const kinds = (r: ReturnType<typeof planOnlineYearCart>) => r.ok ? r.plan.children.map((c) => `${c.name}:${c.kind}`) : r.error;

Deno.test("no live first-child year: the first name typed is the $149 child, the rest $29", () => {
  const r = planOnlineYearCart({ band: "sprouts", childNames: ["Ava", "Ben", "Cal"], liveFirstChildName: null });
  assertEquals(lines(r), ["online_year_sprouts_first_childx1", "online_year_sprouts_siblingx2"]);
  assertEquals(kinds(r), ["Ava:first_child", "Ben:sibling", "Cal:sibling"]);
  if (r.ok) assertEquals(onlineYearPlanCents(r.plan), 14900 + 2 * 2900);
});

Deno.test("one child, no license: $149 only", () => {
  const r = planOnlineYearCart({ band: "seedlings", childNames: ["Ava"], liveFirstChildName: null });
  assertEquals(lines(r), ["online_year_seedlings_first_childx1"]);
});

Deno.test("a sibling year is never sold alone: with a live first-child year every new child is $29", () => {
  const r = planOnlineYearCart({ band: "sprouts", childNames: ["Ben", "Cal"], liveFirstChildName: "Ava" });
  assertEquals(lines(r), ["online_year_sprouts_siblingx2"]);
  assertEquals(kinds(r), ["Ben:sibling", "Cal:sibling"]);
});

Deno.test("renewing the live first child (any case) keeps the $149 year with her", () => {
  const r = planOnlineYearCart({ band: "sprouts", childNames: ["ben", "AVA"], liveFirstChildName: "Ava" });
  assertEquals(kinds(r), ["ben:sibling", "AVA:first_child"]);
  assertEquals(lines(r), ["online_year_sprouts_first_childx1", "online_year_sprouts_siblingx1"]);
});

Deno.test("refusals: band, no children, too many, bad name, repeated name", () => {
  assertEquals(lines(planOnlineYearCart({ band: "kit", childNames: ["Ava"], liveFirstChildName: null })), "unknown_band");
  assertEquals(lines(planOnlineYearCart({ band: "sprouts", childNames: [], liveFirstChildName: null })), "no_children");
  assertEquals(lines(planOnlineYearCart({ band: "sprouts", childNames: "Ava", liveFirstChildName: null })), "no_children");
  assertEquals(lines(planOnlineYearCart({ band: "sprouts", childNames: Array.from({ length: 11 }, (_, i) => `Kid${"abcdefghijk"[i]}`), liveFirstChildName: null })), "too_many_children");
  assertEquals(lines(planOnlineYearCart({ band: "sprouts", childNames: ["Ava", "<b>"], liveFirstChildName: null })), "bad_child_name");
  assertEquals(lines(planOnlineYearCart({ band: "sprouts", childNames: ["Ava", " ava "], liveFirstChildName: null })), "duplicate_child_name");
});

Deno.test("child names: first name or nickname, 1-40 characters, letters", () => {
  assertEquals(cleanChildName("  Mary   Kate "), "Mary Kate");
  assertEquals(cleanChildName("O’Neil"), "O'Neil");
  assertEquals(cleanChildName("Zoë"), "Zoë");
  assertEquals(cleanChildName("J.R."), "J.R.");
  assertEquals(cleanChildName("Anne-Marie"), "Anne-Marie");
  assertEquals(cleanChildName(""), null);
  assertEquals(cleanChildName("   "), null);
  assertEquals(cleanChildName("--"), null);
  assertEquals(cleanChildName("Kid2"), null);
  assertEquals(cleanChildName("a@b.com"), null);
  assertEquals(cleanChildName("x".repeat(41)), null);
  assertEquals(cleanChildName("x".repeat(40)), "x".repeat(40));
  assertEquals(cleanChildName(7), null);
});

Deno.test("metadata round trip: band + one key per child, every value under Stripe's 500 characters", () => {
  const r = planOnlineYearCart({ band: "seedlings", childNames: Array.from({ length: 10 }, (_, i) => `${"x".repeat(39)}${"abcdefghij"[i]}`), liveFirstChildName: null });
  assert(r.ok);
  const md = buildOnlineYearMetadata(r.plan);
  assert(Object.keys(md).length <= 50);
  for (const v of Object.values(md)) assert(v.length <= 500);
  assertEquals(md.lookup_key, "online_year_cart");
  assertEquals(md.oy_kind_1, "first_child");
  assertEquals(md.oy_kind_10, "sibling");
  assertEquals(readOnlineYearMetadata(md), r.plan);
  assertEquals(readOnlineYearMetadata({ ...md, oy_kind_2: "first_child" }), null);
  assertEquals(readOnlineYearMetadata({ ...md, oy_children: "11" }), null);
  assertEquals(readOnlineYearMetadata({ ...md, lookup_key: "wired_cart" }), null);
});

Deno.test("Stripe product names and descriptions: the approved Sprouts words, band swapped for Seedlings", () => {
  assertEquals(onlineYearProductName("sprouts", "first_child"), "Eden's Table Online Year: Sprouts (K-2), first child");
  assertEquals(onlineYearProductName("seedlings", "sibling"), "Eden's Table Online Year: Seedlings (3-5), sibling");
  assertEquals(
    onlineYearProductDescription("seedlings", "first_child"),
    "12 months of online access to all 36 weeks of Seedlings: the Teacher's Guide, the Read-Aloud Storybook, this child's Notebook pages to print, and their portfolio. For one household.",
  );
  assertEquals(onlineYearProductDescription("sprouts", "sibling"), "12 months of this child's Sprouts Notebook pages to print and their own portfolio. Goes with an active first-child Online Year.");
});

Deno.test("dark switch: closed by default, open with ONLINE_YEAR_ENABLED or the preview token (24+ characters)", () => {
  const req = (h?: string) => new Request("https://x/", { headers: h ? { "x-online-year-preview": h } : {} });
  const env = (m: Record<string, string>) => (k: string) => m[k];
  const tok = "p".repeat(32);
  assertEquals(onlineYearOpen(req(), env({})), false);
  assertEquals(onlineYearOpen(req(tok), env({})), false);
  assertEquals(onlineYearOpen(req(tok), env({ ONLINE_YEAR_PREVIEW_TOKEN: tok })), true);
  assertEquals(onlineYearOpen(req("q".repeat(32)), env({ ONLINE_YEAR_PREVIEW_TOKEN: tok })), false);
  assertEquals(onlineYearOpen(req("short"), env({ ONLINE_YEAR_PREVIEW_TOKEN: "short" })), false);
  assertEquals(onlineYearOpen(req(), env({ ONLINE_YEAR_ENABLED: "true" })), true);
  assertEquals(onlineYearOpen(req(), env({ ONLINE_YEAR_ENABLED: "TRUE" })), false);
});
