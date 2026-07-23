// Email shape validation.
//
// These tests exist because of a real incident, not a hypothetical. Six
// addresses entered the homeschool list and then failed EVERY send of the
// vision arc, 36 failed rows in launch_email_queue, because both the client and
// server typo checks opened with:
//
//     if (!domain.includes(".") || domain.endsWith(".")) return null;
//
// That early return means "no opinion", and every caller read it as "the
// address is fine". So a domain with no dot at all, which cannot receive mail,
// skipped every check. The heuristics were built for gmail.con and gmail.co;
// nobody had considered plain gmail.
//
// The six real addresses are pinned below as regression cases. If any of them
// ever passes again, the hole is back.

import { describe, expect, it } from "vitest";
import { checkEmail, hasDeliverableShape } from "@/lib/emailTypos";

// Verbatim from launch_email_queue, status = 'failed'.
const REAL_UNDELIVERABLE = [
  "cassandraburke400@gmail",    // no dot in the domain
  "jen_enserink@hotmail",       // no dot in the domain
  "whollyedenlife@gmail",       // no dot in the domain
  "ckp1968@hotmailcom",         // TLD run together with the domain
  "kalahhester@gmailc",         // mangled TLD, no dot
  "laurenhinken.@outlook.com",  // local part ends in a dot
];

describe("hasDeliverableShape", () => {
  it.each(REAL_UNDELIVERABLE)("rejects the real failed address %s", (email) => {
    expect(hasDeliverableShape(email)).toBe(false);
  });

  it.each([
    "hello@edeninstitute.health",
    "jen_enserink@hotmail.com",
    "a@b.co",
    "first.last@sub.domain.co.uk",
    "camila+tag@gmail.com",
    "ckp1968@hotmail.com",
  ])("accepts the valid address %s", (email) => {
    expect(hasDeliverableShape(email)).toBe(true);
  });

  it.each([
    "",                    // empty
    "nobody",              // no @
    "@gmail.com",          // empty local part
    "someone@",            // empty domain
    ".lead@gmail.com",     // local part starts with a dot
    "x..y@gmail.com",      // consecutive dots in the local part
    "a@b.c",               // single-character TLD
    "a@.com",              // empty first label
    "spaced out@gmail.com",// whitespace
  ])("rejects the malformed address %j", (email) => {
    expect(hasDeliverableShape(email)).toBe(false);
  });
});

describe("checkEmail", () => {
  it.each(REAL_UNDELIVERABLE)("marks %s invalid", (email) => {
    expect(checkEmail(email).invalid).toBe(true);
  });

  it("blocks structurally broken addresses even with no confident suggestion", () => {
    // The regression that mattered: WaitlistModal used to require BOTH invalid
    // AND a suggestion, so an invalid address with no suggestion went through.
    // `invalid` must stand on its own.
    const check = checkEmail("kalahhester@gmailc");
    expect(check.invalid).toBe(true);
  });

  it("still flags the typo cases it was originally built for", () => {
    expect(checkEmail("jess@gmail.con").invalid).toBe(true);
    expect(checkEmail("jess@gmail.co").invalid).toBe(true);
  });

  it("leaves good addresses alone", () => {
    expect(checkEmail("hello@edeninstitute.health")).toEqual({ suggestion: null, invalid: false });
  });

  it("treats empty input as neutral, not invalid", () => {
    // The field is checked on blur while a form is still being filled in.
    expect(checkEmail("")).toEqual({ suggestion: null, invalid: false });
  });
});
