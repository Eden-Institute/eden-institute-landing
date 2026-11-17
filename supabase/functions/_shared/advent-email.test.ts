// The Advent confirmation must be exactly what the founder approved by inbox proof (2026-11-16).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ADVENT_CONFIRM_SUBJECT, buildAdventConfirmEmail } from "./advent-email.ts";

Deno.test("advent confirmation renders byte for byte the approved proof", async () => {
  // Line endings normalised: a Windows checkout (core.autocrlf) turns the fixture's LF into CRLF.
  const raw = await Deno.readTextFile(new URL("./advent-email.approved.html", import.meta.url));
  const approved = raw.replaceAll("\r\n", "\n");
  const got = buildAdventConfirmEmail("Camila");
  assertEquals(got.subject, ADVENT_CONFIRM_SUBJECT);
  assertEquals(got.subject, "You're in for Plants of the Nativity");
  assertEquals(got.html, approved);
});

Deno.test("advent confirmation has no em dash and no unrendered template", () => {
  const { html } = buildAdventConfirmEmail("there");
  assertEquals(/—|&mdash;|&#8212;/.test(html), false);
  assertEquals(html.includes("${"), false);
});
