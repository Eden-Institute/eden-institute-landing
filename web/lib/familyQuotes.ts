// web/lib/familyQuotes.ts: the parent and tester quotes Eden may show on its pages.
// Moved here from web/pages/freebies.astro on 2026-11-27 so the buy pages (/starter,
// /starter/seedlings, /books) can show the same permissioned words (landing-page deep dive;
// founder "Yes to all" in chat). ONE list, so a permission change happens in one place.

// Word for word; a cut is marked with an ellipsis. PERMISSION ON FILE for each,
// as of 2026-10-14 (the Testers tab of the Outreach Bible is the record for T-01/T-02):
//   Kati       written, 2026-07-12, website testimonial (T-01). Her own message says
//              "in to"; /homeschool prints "into". Nested quotes are single here.
//   Amanda     written, 2026-07-06, her whole review on the website (T-02). The cut
//              drops her list of "table cards" and "recipes": the card decks left
//              the free week on 2026-09-12, so this page must not promise them.
//   Brooke     founder's word, 2026-09-15 (no written copy on file).
//   Kendria    founder's word, 2026-09-15 (no written copy on file). The cut drops
//              "can't wait until it launches!", which reads stale now.
//   Coralee    founder's word, 2026-10-14 (no written copy on file).
// Never add a quote here without a permission line above it.
export interface FamilyQuote {
  quote: string;
  who: string;
}

export const FAMILY_QUOTES: FamilyQuote[] = [
  {
    quote: "I just wanted you to see how in to it they are! No complaining and actually asking to do their ‘learning’!!",
    who: "Kati, former nurse and paramedic, whose children did Week 1 in June",
  },
  {
    quote: "I am a mother who has been homeschooling kids for over 18 years. … The balance of faith and herb/gardening is perfect, it is a complete lesson and well thought out.",
    who: "Amanda, homeschooling 18 years, who reviewed the lessons",
  },
  {
    quote: "Ahhhhhh I just spent the last few hours poring over the free sample you sent us. This curriculum is absolutely fantastic. I cannot wait to buy this in the fall. This will be our kids favourite curriculum to explore.",
    who: "Coralee, who read the free sample cover to cover",
  },
  {
    quote: "This is a beautiful curriculum to start. I've just begun reading our teaching guide.",
    who: "Brooke, Clarksville, TN",
  },
  {
    quote: "…this curriculum truly puts it into bite-size chunks of information while still incorporating incredible vocabulary, concepts, and quality stories.",
    who: "Kendria Scriver, curriculum writer",
  },
];
