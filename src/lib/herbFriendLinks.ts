// Links from a /herbs/<slug> page to a friend's site, one short line each.
//
// Every other sentence on a herb page comes from the database (see the header of
// web/pages/herbs/[slug].astro). These are the one authored exception: a link the
// founder promised to a site that links to Eden, placed on the herb page she chose.
// Keyed on herb_id so a rename of the herb cannot drop the link.
//
// 2026-11-16 (punch #455): Danielle's Place (Carolyn) links Eden's free week from
// her Growing in God's Garden lessons; Camila promised to link Carolyn's Flower
// Crafts for Kids page (her email of 2026-11-12) and chose the Calendula page on
// 2026-11-15. Calendula is H004 (Sprouts Week 5, src/lib/curriculumHerbs.ts).

export interface HerbFriendLink {
  /** Small heading over the line. */
  heading: string;
  /** The words before the link. */
  lead: string;
  /** The link text. */
  anchor: string;
  href: string;
  /** data-cta value, so clicks show in analytics. */
  cta: string;
}

export const HERB_FRIEND_LINKS: Record<string, HerbFriendLink[]> = {
  H004: [
    {
      heading: "A craft to go with it",
      lead: "Looking for a hands-on project? Danielle's Place has a whole page of",
      anchor: "Flower Crafts for Kids",
      href: "https://www.daniellesplace.com/html/flower-plant-craft-educational-activities.html",
      cta: "herb-calendula-danielles-place",
    },
  ],
};

export function friendLinksForHerb(herbId: string): HerbFriendLink[] {
  return HERB_FRIEND_LINKS[herbId] ?? [];
}
