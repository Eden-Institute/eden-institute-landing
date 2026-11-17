// 2026-11-17, Lane 2 area 11 T1: an address that only failed because punctuation from the surrounding sentence
// was pasted into the link is forwarded by the 404 page to the real page.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strayPunctuationTarget } from "../../web/lib/strayPunctuation";

describe("stray punctuation on a pasted link", () => {
  it("strips a trailing colon, period, comma, semicolon, bang, bracket or quote", () => {
    expect(strayPunctuationTarget("/freebies:")).toBe("/freebies");
    expect(strayPunctuationTarget("/homeschool.")).toBe("/homeschool");
    expect(strayPunctuationTarget("/books,")).toBe("/books");
    expect(strayPunctuationTarget("/starter;")).toBe("/starter");
    expect(strayPunctuationTarget("/advent!")).toBe("/advent");
    expect(strayPunctuationTarget("/herbs/calendula)")).toBe("/herbs/calendula");
    expect(strayPunctuationTarget("/learn/is-herbalism-biblical\"")).toBe("/learn/is-herbalism-biblical");
    expect(strayPunctuationTarget("/freebies).")).toBe("/freebies");
  });

  it("strips the URL-encoded forms browsers send", () => {
    expect(strayPunctuationTarget("/freebies%3A")).toBe("/freebies");
    expect(strayPunctuationTarget("/freebies%3a")).toBe("/freebies");
    expect(strayPunctuationTarget("/books%2C")).toBe("/books");
    expect(strayPunctuationTarget("/herbs/sage%29")).toBe("/herbs/sage");
  });

  it("leaves real not-found addresses alone (no loop, no guessing)", () => {
    expect(strayPunctuationTarget("/no-such-page")).toBe("");
    expect(strayPunctuationTarget("/freebies/")).toBe("");
    expect(strayPunctuationTarget("/")).toBe("");
    expect(strayPunctuationTarget("")).toBe("");
    expect(strayPunctuationTarget("freebies:")).toBe("");
  });

  it("a root address made only of punctuation goes home", () => {
    expect(strayPunctuationTarget("/.")).toBe("/");
    expect(strayPunctuationTarget("/:")).toBe("/");
  });

  it("the 404 page calls it and keeps the query and #section", () => {
    const src = readFileSync("web/pages/404.astro", "utf8");
    expect(src).toMatch(/strayPunctuationTarget\(window\.location\.pathname\)/);
    expect(src).toMatch(/window\.location\.replace\(target \+ window\.location\.search \+ window\.location\.hash\)/);
  });
});
