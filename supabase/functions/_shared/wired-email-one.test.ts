import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildEmailOne } from "./wired-email-one.ts";

Deno.test("email 1: approved subject, top 3 filled, private results link with its UTM, unsubscribe placeholder, readable footer", () => {
  const m = buildEmailOne({ firstName: "Sarah", nickname: "Lily", top3: ["Maker", "Designer", "Cultivator"], resultsToken: "tok.en" });
  assertEquals(m.subject, "Lily's Wired results are here");
  assertStringIncludes(m.html, "Hi Sarah,");
  assertStringIncludes(m.html, "Their top 3 wirings right now: Maker, Designer and Cultivator.");
  assertStringIncludes(m.html, "Your free results PDF is attached");
  assertEquals(m.buttonUrl, "https://edeninstitute.health/wired/results?t=tok.en&utm_source=email&utm_medium=nurture&utm_campaign=learner_quiz&utm_content=email_1");
  assertStringIncludes(m.html, "See Lily&#39;s results".replace("&#39;", "'"));
  assertStringIncludes(m.html, "{{UNSUB_URL}}");
  assertStringIncludes(m.text, "{{UNSUB_URL}}");
  assertStringIncludes(m.html, "You're getting this because you took the Fearfully &amp; Wonderfully Wired quiz.");
  assertStringIncludes(m.html, "303 Holly Cir, Unit 3262, Clarksville, TN 37043");
  assertStringIncludes(m.html, "color:#E8E3DA");
  assertStringIncludes(m.html, "https://edeninstitute.health/wired/delete"); // W9: the approved Delete my quiz data link
  assert(!m.html.includes("[button]") && !m.text.includes("[") );
});

Deno.test("email 1 without a first name says a plain Hi,", () => {
  const m = buildEmailOne({ firstName: null, nickname: "Ben", top3: ["Seeker", "Ponderer", "Storyteller"], resultsToken: "x" });
  assertStringIncludes(m.html, "Hi,");
  assert(!m.html.includes("Hi ,"));
});
