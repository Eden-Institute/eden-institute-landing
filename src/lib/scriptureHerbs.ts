// Which herb monographs link to /learn/herbs-in-the-bible (2026-10-28, analytics and
// search developer prompt, task 11).
//
// The article sat on page 2 for "herbs in the Bible". The pages most related to it
// are the monographs of plants Scripture names, so they link to it, beside the
// herb's own biblical and traditional record.
//
// Nothing here is authored: the decision is read off the herb's own
// biblical_traditional_reference. A herb qualifies when that text cites a verse of
// the Protestant canon and does not disclaim it. The references are careful to say
// when a plant is NOT in Scripture ("Not named in the canonical biblical texts...",
// anise, cowslip), when a word is only a guess ("possibly", "a candidate for"), or
// when the source is not the canon (the Quran, the Mishnah, the deuterocanonical
// books); those stay out. A debated identification (hyssop, mallow) still links,
// because the link is only "related reading" and claims nothing about the plant.
// Pinned by src/test/scriptureHerbs.test.ts; on 2026-10-28 it selects 34 of 300.

export const HERBS_IN_THE_BIBLE_PATH = "/learn/herbs-in-the-bible";
export const HERBS_IN_THE_BIBLE_TITLE = "Herbs in the Bible for Healing";

const BOOK =
  "(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|(?:[12] )?Samuel|(?:[12] )?Kings|" +
  "(?:[12] )?Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of (?:Solomon|Songs)|" +
  "Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|" +
  "Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|(?:[123] )?John|Acts|Romans|(?:[12] )?Corinthians|" +
  "Galatians|Ephesians|Philippians|Colossians|(?:[12] )?Thessalonians|(?:[12] )?Timothy|Titus|Philemon|" +
  "Hebrews|James|(?:[12] )?Peter|Jude|Revelation)";
const CANON_VERSE = new RegExp(`\\b${BOOK} \\d{1,3}:\\d{1,3}`);
const DISCLAIMED =
  /^\s*not\b|\bnot (?:securely |explicitly |clearly |directly )?(?:named|found|mentioned|attested|in (?:the )?(?:canonical|biblical))/i;
const HEDGED = /\bpossibly\b|\bcandidate\b|\bassociated with\b|deuterocanonical|\bgenus name\b|\bword appears\b/i;

/** True when the herb's own record cites the Bible for it, undisclaimed. */
export function citesScripture(reference: string | null | undefined): boolean {
  if (!reference) return false;
  return CANON_VERSE.test(reference) && !DISCLAIMED.test(reference) && !HEDGED.test(reference);
}
