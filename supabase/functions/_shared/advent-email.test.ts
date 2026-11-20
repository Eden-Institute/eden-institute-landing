// The Advent confirmation must be exactly what the founder approved by inbox proof (2026-11-16).
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ADVENT_CONFIRM_SUBJECT, ADVENT_WINDOWS, adventWindow, buildAdventConfirmEmail } from "./advent-email.ts";

// A sign-up moment before the first Sunday send, so the approved-proof check never depends on today's date.
const EARLY = Date.parse("2026-11-20T12:00:00Z");

Deno.test("advent confirmation renders byte for byte the approved proof", async () => {
  // Line endings normalised: a Windows checkout (core.autocrlf) turns the fixture's LF into CRLF.
  const raw = await Deno.readTextFile(new URL("./advent-email.approved.html", import.meta.url));
  const approved = raw.replaceAll("\r\n", "\n");
  const got = buildAdventConfirmEmail("Camila", EARLY);
  assertEquals(got.subject, ADVENT_CONFIRM_SUBJECT);
  assertEquals(got.subject, "You're in for Plants of the Nativity");
  assertEquals(got.html, approved);
});

Deno.test("advent confirmation has no em dash and no unrendered template", () => {
  for (const w of ADVENT_WINDOWS) {
    const { html } = buildAdventConfirmEmail("there", Date.parse(w.until) - 1000);
    assertEquals(/—|&mdash;|&#8212;/.test(html), false);
    assertEquals(html.includes("${"), false);
  }
});

Deno.test("a late sign-up is told the next Sunday, not one that already went (founder pick 2026-11-20)", () => {
  const at = (iso: string) => buildAdventConfirmEmail("Camila", Date.parse(iso)).html;
  // Up to the first send (Sun Nov 29, 7 PM Central = 01:00 UTC Mon): the approved wording.
  assertStringIncludes(at("2026-11-30T00:59:59Z"), "The first one comes Sunday, November 29, and it starts with one of the wise men's gifts, frankincense.");
  assertStringIncludes(at("2026-11-30T00:59:59Z"), "Four Sundays, then Christmas!");
  const dec6 = at("2026-11-30T01:00:00Z");
  assertStringIncludes(dec6, "Your first one comes Sunday, December 6, and it's myrrh, another of the wise men's gifts.");
  assertStringIncludes(dec6, "Three Sundays, then Christmas!");
  assert(!dec6.includes("November 29") && !dec6.includes("Four Sundays"));
  const dec13 = at("2026-12-10T15:00:00Z");
  assertStringIncludes(dec13, "Your first one comes Sunday, December 13, and it's the terebinth tree.");
  assertStringIncludes(dec13, "Two Sundays, then Christmas!");
  const dec20 = at("2026-12-20T20:00:00Z");
  assertStringIncludes(dec20, "Your first one comes Sunday, December 20, and it's saffron.");
  assertStringIncludes(dec20, "One more Sunday, then Christmas!");
  // After the last send the box is hidden; anything later still gets the last window, never a past date first.
  assertEquals(adventWindow(Date.parse("2026-12-25T00:00:00Z")).closing, "One more Sunday, then Christmas!");
  assertEquals(ADVENT_WINDOWS.map((w) => w.until), ["2026-11-30T01:00:00Z", "2026-12-07T01:00:00Z", "2026-12-14T01:00:00Z", "2026-12-21T01:00:00Z"]);
});
