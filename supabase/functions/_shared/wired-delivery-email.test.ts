import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildDeliveryEmail } from "./wired-delivery-email.ts";

Deno.test("Blueprint delivery: approved subject, greeting, button with its own UTM, address, no unsubscribe", () => {
  const m = buildDeliveryEmail("blueprint", { firstName: "Sarah", nickname: "Lily" });
  assertEquals(m.subject, "Lily's Learner Blueprint");
  assertStringIncludes(m.html, "Hi Sarah,");
  assertStringIncludes(m.html, "Thank you! Lily&#39;s Learner Blueprint is attached.".replace("&#39;", "'"));
  assertEquals(m.buttonUrl, "https://edeninstitute.health/wired/results?utm_source=email&utm_medium=email&utm_campaign=learner_quiz&utm_content=blueprint_delivery");
  assertStringIncludes(m.html, "Invite someone who knows Lily");
  assertStringIncludes(m.html, "303 Holly Cir, Unit 3262, Clarksville, TN 37043");
  assertStringIncludes(m.html, "You&#39;re getting this because of your Wired quiz order.".replace("&#39;", "'"));
  assert(!m.html.includes("Unsubscribe"));
  assert(!m.html.includes("Delete my quiz data"));
  assert(!m.html.includes("[button]") && !m.text.includes("[button]"));
});

Deno.test("Family Map delivery: the one-quick-step lines go when she already answered", () => {
  const a = buildDeliveryEmail("family_map", { firstName: null, hasOwnAnswers: false });
  assertEquals(a.subject, "Your Family Learning Map");
  assertStringIncludes(a.html, "Hi,");
  assertStringIncludes(a.html, "One quick step:");
  assertStringIncludes(a.html, "Answer my questions");
  const b = buildDeliveryEmail("family_map", { firstName: "Sarah", hasOwnAnswers: true });
  assert(!b.html.includes("One quick step:"));
  assert(!b.html.includes("Answer my questions"));
  assertStringIncludes(b.html, "Thank you! Your Family Learning Map is attached, with a full Blueprint for each child.");
});
