// One title and one description template for every herb monograph (2026-10-28,
// analytics and search developer prompt, tasks 14-15; founder decision, not to be
// reopened):
//
//   title        {Common English name} ({Latin binomial}): Traditional Uses & Safety | Eden Apothecary
//   description  {Common name} ({Latin binomial}): traditional uses, preparation and
//                safety cautions, explained plainly. Part of Eden Apothecary's free herb library.
//
// Used by /herbs/<slug> (web/pages/herbs/[slug].astro), the app page
// (src/pages/apothecary/HerbMonograph.tsx) and the build-time heads of every
// /apothecary/<slug> (web/pages/apothecary-heads.json.ts ->
// scripts/build-apothecary-shells.mjs), so all three always agree.
//
// THE NAME. The DB common_name often carries aliases: "Cumin (Jiraka)",
// "Baikal Skullcap (Huang Qin)", "Karela (Bitter Melon)". Titles and H1s lead with
// the English name only; every alias, Sanskrit and pinyin included, moves to an
// "Also known as" line in the body. Slugs come from the full common_name and do not
// change (herbParam), so every existing URL keeps working.
//   - Lead name before " (": the English name, aliases inside the parentheses.
//   - A lead that is a Sanskrit or Hindi name gives way to the English name in that
//     herb's OWN aliases (ENGLISH_FROM_ALIASES). Nothing is translated here: an herb
//     whose row has no English name keeps its own (Ashwagandha, Shatavari, Guggul,
//     ...; founder 2026-10-28: "Keep their names").
//   - "A / B": one English name leads. When one side is just the genus of the
//     binomial ("Platycodon / Balloon Flower"), the other side leads; otherwise the
//     first side. The other side becomes an alias.
//   - A parenthesis that qualifies rather than renames ("Ginseng (American)")
//     reads as one name (QUALIFIED).
// Pinned by src/test/monographMeta.test.ts against real rows.

import { herbBinomial } from "@/lib/herbLinks";

export const MONOGRAPH_TITLE_SUFFIX = ": Traditional Uses & Safety | Eden Apothecary";
const DESCRIPTION_TAIL =
  ": traditional uses, preparation and safety cautions, explained plainly. Part of Eden Apothecary's free herb library.";
/** Google shows about 155-160 characters; the template stays under 160. */
export const MAX_DESCRIPTION = 159;

/** Sanskrit or Hindi lead name -> the English name already among that row's aliases. */
const ENGLISH_FROM_ALIASES: Record<string, string> = {
  Amalaki: "Indian Gooseberry",
  Bhringaraj: "False Daisy",
  Bhumyamalaki: "Stonebreaker",
  Bibhitaki: "Belleric Myrobalan",
  Chirata: "Chiretta",
  Chitrak: "Ceylon Leadwort",
  Daruharidra: "Indian Barberry",
  Gokshura: "Puncture Vine",
  Kalmegh: "Andrographis",
  Kapikacchu: "Velvet Bean",
  Karela: "Bitter Melon",
  Manjistha: "Indian Madder",
  Musta: "Nut Grass",
  Pippali: "Long Pepper",
  Punarnava: "Hogweed",
  Sariva: "Indian Sarsaparilla",
  Vasa: "Malabar Nut",
  Vidanga: "False Black Pepper",
};

/** common_name values whose parenthesis qualifies the name instead of giving an alias. */
const QUALIFIED: Record<string, string> = {
  "Ginseng (American)": "American Ginseng",
  "Ginseng (Asian)": "Asian Ginseng",
  "Betony (Wood)": "Wood Betony",
};

export interface MonographNames {
  /** The name titles and H1s lead with. */
  english: string;
  /** "Genus species", or "" when the row has none. */
  latin: string;
  /** Every other name the row carries, for the "Also known as" line. */
  aka: string[];
}

function splitAliases(inner: string): string[] {
  return inner
    .split(/\s*[,;/]\s*/)
    .map((a) => a.replace(/^(?:also|Ayurvedic|TCM)\s+/i, "").trim())
    .filter(Boolean);
}

export function monographNames(herb: { common_name: string | null; latin_name?: string | null }): MonographNames {
  const full = (herb.common_name ?? "").trim();
  const latin = herbBinomial(herb.latin_name);
  if (QUALIFIED[full]) return { english: QUALIFIED[full], latin, aka: [] };

  const open = full.indexOf(" (");
  let lead = open === -1 ? full : full.slice(0, open).trim();
  const inner = open === -1 ? "" : full.slice(open + 2).replace(/\)\s*$/, "");
  let aka = splitAliases(inner);

  if (lead.includes(" / ")) {
    const [a, b] = lead.split(" / ").map((s) => s.trim());
    const genus = latin.split(" ")[0]?.toLowerCase() ?? "";
    const firstIsGenus = a.toLowerCase() === genus;
    lead = firstIsGenus ? b : a;
    aka = [firstIsGenus ? a : b, ...aka];
  }

  const english = ENGLISH_FROM_ALIASES[lead];
  if (english && aka.some((x) => x.toLowerCase() === english.toLowerCase())) {
    aka = [lead, ...aka.filter((x) => x.toLowerCase() !== english.toLowerCase())];
    lead = english;
  }
  return { english: lead, latin, aka };
}

/** "English (Genus species)", without the parenthesis when there is no binomial or it repeats the name. */
function namePair(n: MonographNames): string {
  return n.latin && n.latin.toLowerCase() !== n.english.toLowerCase() ? `${n.english} (${n.latin})` : n.english;
}

export function monographTitle(herb: { common_name: string | null; latin_name?: string | null }): string {
  return `${namePair(monographNames(herb))}${MONOGRAPH_TITLE_SUFFIX}`;
}

export function monographDescription(herb: { common_name: string | null; latin_name?: string | null }): string {
  const n = monographNames(herb);
  const full = `${namePair(n)}${DESCRIPTION_TAIL}`;
  // Over the limit only for a very long name pair: the binomial goes, the template stays.
  return full.length <= MAX_DESCRIPTION ? full : `${n.english}${DESCRIPTION_TAIL}`;
}
