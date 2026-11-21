// The July yearly-retest pre-fill (spec 7.5): the signed link and what wired-retake answers.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assumedGrade, retakeContext } from "./wired-retake.ts";
import { signWiredToken, verifyWiredToken } from "./wired-token.ts";
import { quizYear } from "./wired-engine.ts";

Deno.env.set("WIRED_LINK_SECRET", "w".repeat(64));
const FAM = "11111111-1111-1111-1111-111111111111";
const KID = "22222222-2222-2222-2222-222222222222";
const DB = { url: "https://db", key: "k" };
const NOW = new Date("2027-07-02T15:00:00Z"); // quiz year 2027 has just begun

function install(o: { child?: Record<string, unknown> | null; last?: number | null; fam?: boolean } = {}) {
  globalThis.fetch = ((input: string | URL) => {
    const p = String(input).split("/rest/v1/")[1];
    const j = (v: unknown) => Promise.resolve(new Response(JSON.stringify(v), { status: 200 }));
    if (p.startsWith("wired_families")) return j(o.fam === false ? [] : [{ email: "mom@example.com" }]);
    if (p.startsWith("wired_children")) return j(o.child === null ? [] : [o.child ?? { id: KID, nickname: "Lily", grade: 2, unlocked_via: "free" }]);
    if (p.startsWith("wired_results")) return j(o.last === null ? [] : [{ quiz_year: o.last ?? 2026 }]);
    return j([]);
  }) as typeof fetch;
}

Deno.test("retake link: signed for one child, purpose-bound, verifies only as 'retake'", async () => {
  const t = await signWiredToken({ familyId: FAM, purpose: "retake", childId: KID });
  assertEquals((await verifyWiredToken(t, "retake"))?.childId, KID);
  assertEquals(await verifyWiredToken(t, "results"), null);
  assertEquals(await verifyWiredToken(t + "x", "retake"), null);
});

Deno.test("retake context: nickname, grade + 1 and her email for a child due this July", async () => {
  assertEquals(quizYear(NOW), 2027);
  install();
  assertEquals(await retakeContext(DB, { familyId: FAM, purpose: "retake", childId: KID, expiresAt: 0 }, NOW),
    { status: "ok", child_id: KID, nickname: "Lily", grade: 3, email: "mom@example.com" });
  assertEquals(assumedGrade(0, 2025, 2027), 2);
});

Deno.test("retake context: already retested this year, graduated, never had results, gone, or another family", async () => {
  const g = { familyId: FAM, purpose: "retake" as const, childId: KID, expiresAt: 0 };
  install({ last: 2027 });
  assertEquals((await retakeContext(DB, g, NOW)).status, "already");
  install({ child: { id: KID, nickname: "Sam", grade: 12, unlocked_via: "blueprint" } });
  assertEquals((await retakeContext(DB, g, NOW)).status, "not_due");
  install({ last: null });
  assertEquals((await retakeContext(DB, g, NOW)).status, "not_due");
  install({ child: { id: KID, nickname: "Ana", grade: 4, unlocked_via: null } }); // locked 3rd child
  assertEquals((await retakeContext(DB, g, NOW)).status, "unknown");
  install({ child: null });
  assertEquals((await retakeContext(DB, g, NOW)).status, "unknown");
  install({ fam: false });
  assertEquals((await retakeContext(DB, g, NOW)).status, "unknown");
  install();
  assertEquals((await retakeContext(DB, { ...g, childId: undefined }, NOW)).status, "unknown");
});
