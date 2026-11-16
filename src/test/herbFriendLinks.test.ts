// Friend's-site links on /herbs pages (punch #455, 2026-11-16).
import { describe, expect, it } from "vitest";
import { HERB_FRIEND_LINKS, friendLinksForHerb } from "@/lib/herbFriendLinks";

describe("herb friend links", () => {
  it("puts the promised Danielle's Place link on Calendula (H004) only", () => {
    const links = friendLinksForHerb("H004");
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe(
      "https://www.daniellesplace.com/html/flower-plant-craft-educational-activities.html",
    );
    expect(links[0].anchor).toBe("Flower Crafts for Kids");
    expect(Object.keys(HERB_FRIEND_LINKS)).toEqual(["H004"]);
  });

  it("returns nothing for a herb with no friend link", () => {
    expect(friendLinksForHerb("H001")).toEqual([]);
  });

  it("keys on real herb ids, links over https, and carries no em or en dashes", () => {
    for (const [herbId, links] of Object.entries(HERB_FRIEND_LINKS)) {
      expect(herbId).toMatch(/^H\d{3}$/);
      for (const l of links) {
        expect(l.href).toMatch(/^https:\/\//);
        expect(l.cta).toMatch(/^herb-[a-z0-9-]+$/);
        for (const text of [l.heading, l.lead, l.anchor]) expect(text).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });
});
