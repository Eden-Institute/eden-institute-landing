// Which monographs link to /learn/herbs-in-the-bible (2026-10-28). The sentences are
// excerpts of the live herbs.biblical_traditional_reference rows.
import { describe, expect, it } from "vitest";
import { citesScripture } from "@/lib/scriptureHerbs";

describe("citesScripture", () => {
  it("links the plants Scripture names", () => {
    for (const ref of [
      "Named repeatedly in Scripture: Exodus 12:22 (blood applied to the doorposts at Passover), Leviticus 14:4-6 and Numbers 19:6, 18 (purification rites), Psalm 51:7",
      "Exodus 30:23 (myrrh in the holy anointing oil); Esther 2:12; Psalm 45:8; Song of Songs 3:6, 4:14, 5:5; Matthew 2:11 (gift of the Magi)",
      "Prominent throughout Scripture: the fig leaf covering (Genesis 3:7); the fig as emblem of peace and plenty, every man under his vine and fig tree (1 Kings 4:25;",
      "Peppermint — Mentha referenced in Matthew 23:23 and Luke 11:42 (mint as temple tithe); ancient Egypt documented mint cultivation",
      "Named by Jesus in Luke 11:42: 'you tithe mint and rue and every herb, and pass over justice and the love of God.'",
    ]) {
      expect(citesScripture(ref), ref.slice(0, 40)).toBe(true);
    }
  });

  it("leaves out a plant whose record says it is not in Scripture", () => {
    expect(citesScripture("Not securely named in the canonical biblical texts. The King James Version of Matthew 23:23 reads that the Pharisees tithed 'mint and anise and cumin,'")).toBe(false);
    expect(citesScripture("Not named in the canonical biblical texts; a European (British) meadow herb whose name derives from Old English")).toBe(false);
    expect(citesScripture("Origanum vulgare itself is not named in canonical Scripture. Its Levantine relative Origanum syriacum (Exodus 12:22)")).toBe(false);
  });

  it("leaves out guesses and sources outside the canon", () => {
    expect(citesScripture("Ginger — referenced in Confucian Analects; ancient Sanskrit texts; the Quran mentions ginger as a spice of Paradise (Surah 76:17)")).toBe(false);
    expect(citesScripture("Lavender — possibly referenced as \"Spikenard\" (nard) in Song of Solomon 1:12; 4:13-14")).toBe(false);
    expect(citesScripture("A leading botanical candidate for the biblical bitter herbs (maror) eaten with the Passover lamb (Exodus 12:8;")).toBe(false);
    expect(citesScripture("The mastic tree (Greek schinos) appears in the deuterocanonical Book of Susanna (Daniel 13:54-55, Septuagint)")).toBe(false);
  });

  it("needs a verse, not just a mention", () => {
    expect(citesScripture("Agrimony (Agrimonia eupatoria) — the species name eupatoria honors Mithridates Eupator, king of Pontus and an early herbalist")).toBe(false);
    expect(citesScripture("Fennel — referenced in ancient Egyptian texts; among the nine sacred herbs of Anglo-Saxon tradition; used in biblical Palestine")).toBe(false);
    expect(citesScripture(null)).toBe(false);
    expect(citesScripture("")).toBe(false);
  });
});
