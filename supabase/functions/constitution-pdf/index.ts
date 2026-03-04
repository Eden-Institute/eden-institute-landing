import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brand colors
const DARK_SAGE = rgb(0.176, 0.314, 0.086);    // #2D5016
const MEDIUM_SAGE = rgb(0.290, 0.486, 0.184);  // #4A7C2F
const CREAM = rgb(0.980, 0.965, 0.933);         // #FAF6EE
const GOLD = rgb(0.761, 0.635, 0.153);          // #C9A227
const WHITE = rgb(1, 1, 1);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface Fonts {
  serif: PDFFont;
  serifBold: PDFFont;
  serifItalic: PDFFont;
  serifBoldItalic: PDFFont;
}

// ─── Text utilities ───

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') { lines.push(''); continue; }
    const words = paragraph.split(' ');
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

// ─── Page manager ───

class PDFBuilder {
  doc: PDFDocument;
  fonts!: Fonts;
  page!: PDFPage;
  y = 0;
  pageNum = 0;

  constructor(doc: PDFDocument) { this.doc = doc; }

  async init() {
    this.fonts = {
      serif: await this.doc.embedFont(StandardFonts.TimesRoman),
      serifBold: await this.doc.embedFont(StandardFonts.TimesRomanBold),
      serifItalic: await this.doc.embedFont(StandardFonts.TimesRomanItalic),
      serifBoldItalic: await this.doc.embedFont(StandardFonts.TimesRomanBoldItalic),
    };
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageNum++;
    // Cream background
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
    this.y = PAGE_H - MARGIN;
    this.drawFooter();
  }

  drawFooter() {
    const f = this.fonts.serifItalic;
    const txt = "The Eden Institute  |  EdenInstitute.health";
    const w = f.widthOfTextAtSize(txt, 8);
    this.page.drawLine({ start: { x: MARGIN, y: 46 }, end: { x: PAGE_W - MARGIN, y: 46 }, thickness: 0.5, color: GOLD });
    this.page.drawText(txt, { x: (PAGE_W - w) / 2, y: 34, size: 8, font: f, color: MEDIUM_SAGE });
    // Page number
    const pn = `${this.pageNum}`;
    const pw = f.widthOfTextAtSize(pn, 8);
    this.page.drawText(pn, { x: (PAGE_W - pw) / 2, y: 22, size: 8, font: f, color: GOLD });
  }

  ensureSpace(needed: number) {
    if (this.y - needed < 60) {
      this.newPage();
    }
  }

  drawCoverPage(title: string, subtitle: string, tagline: string) {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageNum++;
    // Full dark sage background
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: DARK_SAGE });

    let y = PAGE_H - 120;

    // Brand name
    const brand = "THE EDEN INSTITUTE";
    const bw = this.fonts.serifBold.widthOfTextAtSize(brand, 14);
    this.page.drawText(brand, { x: (PAGE_W - bw) / 2, y, size: 14, font: this.fonts.serifBold, color: GOLD });
    y -= 22;

    // Gold divider
    this.page.drawLine({ start: { x: (PAGE_W - 80) / 2, y }, end: { x: (PAGE_W + 80) / 2, y }, thickness: 1.5, color: GOLD });
    y -= 22;

    const motto = "Back to Eden. Back to Truth.";
    const mw = this.fonts.serifItalic.widthOfTextAtSize(motto, 11);
    this.page.drawText(motto, { x: (PAGE_W - mw) / 2, y, size: 11, font: this.fonts.serifItalic, color: CREAM });
    y -= 100;

    // Title
    const titleLines = wrapText(title, this.fonts.serifBold, 28, CONTENT_W - 40);
    for (const line of titleLines) {
      const lw = this.fonts.serifBold.widthOfTextAtSize(line, 28);
      this.page.drawText(line, { x: (PAGE_W - lw) / 2, y, size: 28, font: this.fonts.serifBold, color: CREAM });
      y -= 36;
    }
    y -= 6;

    // Subtitle
    const sw = this.fonts.serifItalic.widthOfTextAtSize(subtitle, 16);
    this.page.drawText(subtitle, { x: (PAGE_W - sw) / 2, y, size: 16, font: this.fonts.serifItalic, color: GOLD });
    y -= 50;

    // Gold divider
    this.page.drawLine({ start: { x: (PAGE_W - 120) / 2, y }, end: { x: (PAGE_W + 120) / 2, y }, thickness: 1, color: GOLD });
    y -= 30;

    // Tagline
    const tagLines = wrapText(`"${tagline}"`, this.fonts.serifItalic, 12, CONTENT_W - 80);
    for (const line of tagLines) {
      const lw = this.fonts.serifItalic.widthOfTextAtSize(line, 12);
      this.page.drawText(line, { x: (PAGE_W - lw) / 2, y, size: 12, font: this.fonts.serifItalic, color: CREAM });
      y -= 18;
    }
    y -= 40;

    const compText = "A Comprehensive Guide to Your Constitutional Pattern";
    const cw = this.fonts.serif.widthOfTextAtSize(compText, 11);
    this.page.drawText(compText, { x: (PAGE_W - cw) / 2, y, size: 11, font: this.fonts.serif, color: GOLD });
    y -= 60;

    const url = "EdenInstitute.health";
    const uw = this.fonts.serifBold.widthOfTextAtSize(url, 11);
    this.page.drawText(url, { x: (PAGE_W - uw) / 2, y, size: 11, font: this.fonts.serifBold, color: GOLD });
  }

  drawSectionHeader(text: string) {
    this.ensureSpace(50);
    // Gold accent bar
    this.page.drawRectangle({ x: MARGIN, y: this.y - 2, width: CONTENT_W, height: 26, color: DARK_SAGE });
    const tw = this.fonts.serifBold.widthOfTextAtSize(text, 13);
    this.page.drawText(text, { x: (PAGE_W - tw) / 2, y: this.y + 4, size: 13, font: this.fonts.serifBold, color: GOLD });
    this.y -= 40;
  }

  drawSubheading(text: string) {
    this.ensureSpace(30);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 12, font: this.fonts.serifBold, color: DARK_SAGE });
    this.y -= 6;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + this.fonts.serifBold.widthOfTextAtSize(text, 12), y: this.y }, thickness: 0.5, color: GOLD });
    this.y -= 16;
  }

  drawParagraph(text: string, fontSize = 10, font?: PDFFont, color = DARK_SAGE, indent = 0) {
    const f = font || this.fonts.serif;
    const lines = wrapText(text, f, fontSize, CONTENT_W - indent);
    for (const line of lines) {
      this.ensureSpace(14);
      if (line === '') { this.y -= 6; continue; }
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size: fontSize, font: f, color });
      this.y -= fontSize + 4;
    }
    this.y -= 4;
  }

  drawBullet(text: string, fontSize = 10) {
    const lines = wrapText(text, this.fonts.serif, fontSize, CONTENT_W - 20);
    for (let i = 0; i < lines.length; i++) {
      this.ensureSpace(14);
      if (i === 0) {
        this.page.drawText("\u2022", { x: MARGIN + 4, y: this.y, size: fontSize, font: this.fonts.serif, color: GOLD });
      }
      this.page.drawText(lines[i], { x: MARGIN + 18, y: this.y, size: fontSize, font: this.fonts.serif, color: DARK_SAGE });
      this.y -= fontSize + 4;
    }
  }

  drawScripture(text: string) {
    this.ensureSpace(40);
    const lines = wrapText(text, this.fonts.serifItalic, 10, CONTENT_W - 26);
    const h = lines.length * 14 + 8;
    this.page.drawRectangle({ x: MARGIN, y: this.y - h + 18, width: 3, height: h, color: GOLD });
    for (const line of lines) {
      this.ensureSpace(14);
      this.page.drawText(line, { x: MARGIN + 14, y: this.y, size: 10, font: this.fonts.serifItalic, color: DARK_SAGE });
      this.y -= 14;
    }
    this.y -= 8;
  }

  drawHerb(num: number, name: string, latin: string, actions: string, match: string, prep: string, note: string) {
    this.ensureSpace(60);
    // Herb number + name
    this.page.drawText(`${num}.`, { x: MARGIN, y: this.y, size: 11, font: this.fonts.serifBold, color: GOLD });
    this.page.drawText(`${name} (${latin})`, { x: MARGIN + 18, y: this.y, size: 11, font: this.fonts.serifBold, color: DARK_SAGE });
    this.y -= 18;

    this.drawParagraph(`Actions: ${actions}`, 9, this.fonts.serifItalic, MEDIUM_SAGE, 4);
    this.drawParagraph(`Constitutional Match: ${match}`, 9.5, undefined, undefined, 4);
    this.drawParagraph(`Preparation: ${prep}`, 9.5, undefined, undefined, 4);
    if (note) {
      this.drawParagraph(`Note: ${note}`, 9, this.fonts.serifItalic, MEDIUM_SAGE, 4);
    }
    this.y -= 4;
  }

  drawCTABlock(heading: string, body: string, url: string) {
    this.ensureSpace(80);
    // Gold bordered box
    const boxH = 70;
    this.page.drawRectangle({ x: MARGIN, y: this.y - boxH + 10, width: CONTENT_W, height: boxH, color: DARK_SAGE });
    let by = this.y;
    const hw = this.fonts.serifBold.widthOfTextAtSize(heading, 14);
    this.page.drawText(heading, { x: (PAGE_W - hw) / 2, y: by - 4, size: 14, font: this.fonts.serifBold, color: GOLD });
    by -= 22;
    const bw2 = this.fonts.serifItalic.widthOfTextAtSize(body, 10);
    this.page.drawText(body, { x: (PAGE_W - bw2) / 2, y: by, size: 10, font: this.fonts.serifItalic, color: CREAM });
    by -= 20;
    const uw = this.fonts.serifBold.widthOfTextAtSize(url, 11);
    this.page.drawText(url, { x: (PAGE_W - uw) / 2, y: by, size: 11, font: this.fonts.serifBold, color: GOLD });
    this.y -= boxH + 10;
  }

  drawDisclaimer() {
    this.ensureSpace(50);
    this.y -= 10;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.5, color: GOLD });
    this.y -= 14;
    const brand = "THE EDEN INSTITUTE";
    const bw = this.fonts.serifBold.widthOfTextAtSize(brand, 10);
    this.page.drawText(brand, { x: (PAGE_W - bw) / 2, y: this.y, size: 10, font: this.fonts.serifBold, color: DARK_SAGE });
    this.y -= 14;
    const motto = "Back to Eden. Back to Truth.";
    const mw = this.fonts.serifItalic.widthOfTextAtSize(motto, 9);
    this.page.drawText(motto, { x: (PAGE_W - mw) / 2, y: this.y, size: 9, font: this.fonts.serifItalic, color: MEDIUM_SAGE });
    this.y -= 14;
    const url = "EdenInstitute.health";
    const uw = this.fonts.serifBold.widthOfTextAtSize(url, 9);
    this.page.drawText(url, { x: (PAGE_W - uw) / 2, y: this.y, size: 9, font: this.fonts.serifBold, color: GOLD });
    this.y -= 20;
    const disc = "This guide is educational only and does not constitute medical advice. For complex or serious health concerns, consult a qualified practitioner.";
    const dl = wrapText(disc, this.fonts.serifItalic, 8, CONTENT_W);
    for (const line of dl) {
      const dw = this.fonts.serifItalic.widthOfTextAtSize(line, 8);
      this.page.drawText(line, { x: (PAGE_W - dw) / 2, y: this.y, size: 8, font: this.fonts.serifItalic, color: MEDIUM_SAGE });
      this.y -= 11;
    }
  }
}

// ═══════════════════════════════════════════════════════
// HOT/DRY COMPREHENSIVE GUIDE
// ═══════════════════════════════════════════════════════

async function generateHotDryGuide(doc: PDFDocument): Promise<void> {
  const b = new PDFBuilder(doc);
  await b.init();

  // ── COVER ──
  b.drawCoverPage(
    "HOT / DRY CONSTITUTION",
    "The Choleric Pattern",
    "You run warm, think fast, and burn through resources quickly."
  );

  // ── SECTION: YOUR PATTERN ──
  b.newPage();
  b.drawSectionHeader("YOUR PATTERN");
  b.drawSubheading("Understanding the Hot/Dry Constitutional Tendency");

  b.drawParagraph("You are wired for intensity. Your metabolism runs high, your mind moves quickly, and your body generates heat readily. This is not a flaw \u2014 it is how God designed you. The Hot/Dry constitution reflects a pattern of vital force that is active, penetrating, and consuming.");
  b.drawParagraph("Under normal conditions, this constitutional pattern manifests as sharp mental clarity, strong digestion, assertive energy, and the capacity for sustained effort. You tend to be decisive, action-oriented, and capable of intense focus.");

  b.drawSubheading("Physical Tendencies");
  const physicals = [
    "A tendency toward inflammation, heat conditions, and acute reactions",
    "Dry skin, dry eyes, and dryness in the mucous membranes",
    "Constipation or hard, dry stools due to insufficient moisture in the bowel",
    "Strong appetite, efficient digestion, but a tendency to burn through nutrients quickly",
    "Difficulty tolerating heat, warm environments, or hot seasons",
    "Tendency toward tension headaches, particularly behind the eyes or at the temples",
    "Redness, flushing, or skin eruptions when overheated or overstressed",
  ];
  for (const p of physicals) b.drawBullet(p);
  b.y -= 6;

  b.drawSubheading("Emotional and Mental Tendencies");
  const emotionals = [
    "Irritability, impatience, or a short fuse when under stress",
    "A driven, goal-oriented mindset that can tip into obsession",
    "Difficulty relaxing, winding down, or surrendering control",
    "A tendency toward perfectionism and self-criticism",
    "Sleep disturbances, particularly difficulty falling asleep due to an overactive mind",
    "A sense of urgency that does not quiet easily",
  ];
  for (const e of emotionals) b.drawBullet(e);
  b.y -= 6;

  b.drawSubheading("When Imbalanced");
  b.drawParagraph("When the Hot/Dry pattern becomes excessive, you may experience inflammatory conditions (joint inflammation, skin inflammation, digestive inflammation), burnout from overwork, depletion from insufficient rest, and emotional volatility. The fire that fuels your drive can consume you if not properly tended.");

  // ── SECTION: HISTORICAL CONTEXT ──
  b.drawSectionHeader("HISTORICAL CONTEXT");
  b.drawSubheading("The Choleric Temperament in Classical Medicine");

  b.drawParagraph("The Hot/Dry constitution corresponds to what classical Greek and Western medicine called the Choleric temperament, associated with the element of Fire and the humor of Yellow Bile.");
  b.drawParagraph("Hippocrates (460-370 BC) and later Galen (129-216 AD) observed that individuals with an excess of this humor tended to be ambitious, leader-like, restless, and easily angered. The term \"choleric\" derives from the Greek chole (bile), reflecting the belief that an excess of yellow bile produced both the physical and temperamental characteristics of this type.");
  b.drawParagraph("In the Eclectic and Physiomedical traditions of 19th-century American herbalism, practitioners recognized this pattern and developed specific therapeutic strategies: cooling herbs to reduce excess heat, moistening herbs to counter dryness, and relaxant nervines to calm an overactive nervous system.");
  b.drawParagraph("Dr. John Scudder, in his 1870 work Specific Medication, emphasized reading the patient's \"expression of disease\" \u2014 including the quality of heat, dryness, and tension \u2014 before selecting remedies. This constitutional approach preceded the modern tendency to match herbs to symptoms without regard for the person taking them.");

  // ── SECTION: BIBLICAL FRAMEWORK ──
  b.drawSectionHeader("BIBLICAL FRAMEWORK");
  b.drawSubheading("A Christian Understanding of Constitutional Medicine");

  b.drawParagraph("The recognition that people differ in consistent, observable, and clinically significant ways is not borrowed from Eastern religion \u2014 it is confirmed by centuries of Western observation and is consistent with the biblical teaching that each person is \"fearfully and wonderfully made\" (Psalm 139:14).");
  b.drawParagraph("God did not create one human template stamped out in endless copies. He wove each person with particular tendencies, strengths, and vulnerabilities. Constitutional medicine honors this particularity rather than treating all bodies as interchangeable.");

  b.drawSubheading("What We Learn From Tradition \u2014 Without Adopting Its Metaphysics");
  b.drawParagraph("The Greek humoral system, Ayurveda, and Traditional Chinese Medicine all observed similar constitutional patterns independently. This is not because they share the same spiritual framework \u2014 they do not. It is because they were all observing the same creation.");
  b.drawParagraph("We do not need to adopt the metaphysics of these systems to benefit from their observational wisdom. We reject the idea that your constitution is determined by planetary influence, karmic imprint, or the balance of primal elements with independent existence. Instead, we affirm that your constitutional pattern reflects the particular way God designed your body to function \u2014 with its own tendencies, its own needs, and its own path toward flourishing.");
  b.drawParagraph("The Hot/Dry pattern is not a spiritual diagnosis. It is a physiological observation with practical implications for how you should eat, rest, exercise, and \u2014 when needed \u2014 select herbal support.");

  b.drawSubheading("Stewardship, Not Superstition");
  b.drawParagraph("The Christian herbalist approaches constitutional medicine as a steward, not a mystic. We observe the body's patterns because God made the body readable. We select herbs that correspond to constitutional needs because God placed those herbs in creation with intention.");
  b.drawScripture("\"A tranquil heart gives life to the flesh\" (Proverbs 14:30). This is not mysticism \u2014 it is physiology confirmed by Scripture. The Hot/Dry constitution, with its tendency toward intensity and heat, benefits from practices and herbs that cultivate tranquility, coolness, and moisture. This is cooperation with design, not manipulation of energy.");
  b.drawParagraph("The intelligence that regulates your body \u2014 the coherence that holds your systems together \u2014 is not an impersonal force. It is upheld by the One in whom \"all things hold together\" (Colossians 1:17). Herbal medicine, rightly understood, is partnership with this design.");

  // ── SECTION: YOUR HERBAL ALLIES ──
  b.drawSectionHeader("YOUR HERBAL ALLIES");
  b.drawSubheading("10 Herbs That Support the Hot/Dry Constitution");
  b.drawParagraph("The herbs that best support your constitutional pattern are those that cool excess heat, moisten dryness, relax tension, and nourish depleted tissues. These are not remedies for specific diseases \u2014 they are allies for your particular body.");

  b.drawHerb(1, "Marshmallow Root", "Althaea officinalis",
    "Demulcent, emollient, cooling, moistening, anti-inflammatory",
    "Marshmallow is the quintessential remedy for the Hot/Dry pattern. Its abundant mucilage coats and soothes irritated, inflamed tissues \u2014 whether in the digestive tract, urinary system, or respiratory passages. It directly addresses the dryness that characterizes your constitution.",
    "Cold infusion is best to preserve the mucilage. Place 1\u20132 tablespoons of dried root in a quart of room-temperature water and let steep 4\u20138 hours or overnight. Strain and drink throughout the day.",
    "May slow absorption of medications if taken simultaneously. Separate by 1\u20132 hours."
  );

  b.drawHerb(2, "Lemon Balm", "Melissa officinalis",
    "Cooling nervine, carminative, mild sedative, antiviral, diaphoretic",
    "Lemon Balm cools heat, calms the nervous system, and lifts the spirits without sedation. For the Hot/Dry type prone to irritability, anxiety, and overactive thinking, it is a gentle ally that brings peace without suppression.",
    "Fresh plant is strongest. Standard hot infusion: 1\u20132 teaspoons dried herb per cup, steep covered 10\u201315 minutes. Drink freely throughout the day.",
    "May theoretically affect thyroid function at very high doses; standard use is safe."
  );

  b.drawHerb(3, "Rose", "Rosa spp.",
    "Cooling, mildly astringent, nervine, heart tonic, anti-inflammatory",
    "Rose cools heat and soothes emotional inflammation. It is particularly indicated when the Hot/Dry pattern manifests as emotional volatility, grief held as tension, or a heart that has hardened under stress. Rose opens and softens.",
    "Infusion of dried rose petals, rose water added to beverages, or glycerite. Rose honey is traditional and nourishing.",
    "Ensure roses are organically grown and unsprayed."
  );

  b.drawHerb(4, "Violet Leaf", "Viola odorata",
    "Cooling, moistening, lymphatic, demulcent, mild alterative",
    "Violet is gently cooling and deeply moistening. It supports lymphatic movement (important when heat creates stagnation) and nourishes dry tissues over time. Its gentle nature makes it suitable for long-term use.",
    "Fresh leaves in salads, or standard infusion of dried leaves. Cold infusion preserves more mucilage.",
    "Seeds and roots have different properties; leaves are safest for general use."
  );

  b.drawHerb(5, "Elderflower", "Sambucus nigra",
    "Cooling diaphoretic, relaxant, anti-catarrhal, gentle circulatory stimulant",
    "Elderflower opens the pores and allows heat to escape through gentle sweating. For the Hot/Dry constitution that tends to trap heat internally, elderflower provides a safe release valve. It is particularly useful at the onset of feverish conditions.",
    "Hot infusion: 1\u20132 teaspoons dried flowers per cup, steep covered 10\u201315 minutes. Drink hot to promote diaphoresis.",
    "Only flowers and ripe berries should be used; other plant parts contain compounds requiring careful preparation."
  );

  b.drawHerb(6, "Chamomile", "Matricaria chamomilla",
    "Cooling, anti-inflammatory, carminative, nervine relaxant, bitter tonic",
    "Chamomile cools heat in the digestive system, calms nervous irritability, and promotes restful sleep. For the Hot/Dry type who runs on intensity and struggles to wind down, chamomile is a reliable daily ally.",
    "Standard hot infusion, covered to preserve volatile oils. 1\u20132 teaspoons per cup, steep 10 minutes.",
    "Avoid if allergic to plants in the Asteraceae family."
  );

  b.drawHerb(7, "Milky Oats", "Avena sativa",
    "Nervine trophorestorative, nutritive, moistening, restorative",
    "Milky oats rebuild a depleted nervous system. When the Hot/Dry constitution has burned too hot for too long, the nervous system becomes frayed. Milky oats nourish and restore over time \u2014 not by sedation, but by replenishment.",
    "Fresh milky oat tincture is most potent (harvested when the seed exudes milky latex). Oatstraw infusion (1 oz dried herb to 1 quart water, steep 4+ hours) is deeply nourishing.",
    "Gluten-sensitive individuals should confirm oats are certified gluten-free."
  );

  b.drawHerb(8, "Hawthorn", "Crataegus spp.",
    "Cardiovascular tonic, hypotensive, nervine, mildly cooling",
    "Hawthorn is specific for the heart \u2014 both physically and emotionally. For the Hot/Dry constitution prone to cardiovascular tension, elevated blood pressure, and emotional guardedness, hawthorn strengthens, protects, and gently opens.",
    "Tincture of berries, leaves, and flowers. Decoction of berries. Long infusion of leaves and flowers. Safe for long-term use.",
    "May potentiate cardiac medications; consult a practitioner if on heart medication."
  );

  b.drawHerb(9, "Lavender", "Lavandula angustifolia",
    "Cooling nervine, carminative, antispasmodic, circulatory stimulant",
    "Lavender cools heat that rises to the head \u2014 tension headaches, irritability, sleeplessness. It moves stagnant energy without adding heat. For the Hot/Dry type with a busy mind and tense body, lavender is calming without being sedating.",
    "Infusion of flowers (use sparingly \u2014 very aromatic). External use: essential oil diluted in carrier oil for temples and neck. Lavender honey or glycerite.",
    "Essential oil should not be taken internally without professional guidance."
  );

  b.drawHerb(10, "Licorice Root", "Glycyrrhiza glabra",
    "Demulcent, anti-inflammatory, adrenal restorative, expectorant, harmonizer",
    "Licorice moistens dryness, soothes inflammation, and supports adrenal glands depleted by chronic stress. For the Hot/Dry constitution that has burned through its reserves, licorice is deeply restorative.",
    "Decoction (simmer 20\u201330 minutes) or as part of herbal formulas where it harmonizes other herbs.",
    "Not for long-term use at high doses. Avoid in hypertension, edema, or potassium deficiency. DGL (deglycyrrhizinated) form is safer for long-term digestive use."
  );

  // ── SECTION: HERBS TO USE WITH CAUTION ──
  b.drawSectionHeader("HERBS TO USE WITH CAUTION");
  b.drawParagraph("The following herbs, while beneficial for other constitutional types, may aggravate the Hot/Dry pattern if used excessively or without balancing support:");

  const cautions = [
    "Cayenne (Capsicum annuum): Intensely heating and drying. May worsen inflammation, irritability, and digestive heat.",
    "Ginger (Zingiber officinale): Warming and drying. Small amounts are fine; large amounts or long-term use may increase heat.",
    "Cinnamon (Cinnamomum spp.): Warming. Use in moderation as a spice; avoid as a primary remedy.",
    "Coffee (Coffea arabica): Heating, drying, and stimulating. May worsen anxiety, insomnia, and adrenal depletion.",
    "Ephedra (Ephedra sinica): Strongly stimulating and drying. Generally contraindicated for this constitution.",
    "Damiana (Turnera diffusa): Warming and stimulating. May aggravate heat symptoms.",
    "Excessive bitter herbs: Strong bitters can be drying over time. Balance with demulcents if using.",
  ];
  for (const c of cautions) b.drawBullet(c);

  // ── SECTION: GO DEEPER ──
  b.drawSectionHeader("GO DEEPER");
  b.drawSubheading("What You'll Unlock in the Eden Apothecary App");
  b.drawParagraph("This guide has introduced you to your constitutional pattern through the lens of Western herbal tradition. But this is only the beginning.");
  b.drawParagraph("In the Eden Apothecary app, you will discover:");

  const deeper = [
    "Deeper Constitutional Mapping: How your Hot/Dry pattern corresponds to the Ayurvedic Pitta dosha and the TCM pattern of Liver Fire Rising \u2014 with the practical insights extracted from these traditions, translated into a Western and Biblical framework.",
    "50+ Additional Herbs: A comprehensive materia medica organized by constitutional affinity, with detailed monographs including actions, preparations, dosages, and contraindications.",
    "Body System Integration: How your constitutional pattern tends to manifest in each body system \u2014 digestive, respiratory, nervous, cardiovascular, endocrine, and more \u2014 with targeted herbal protocols for each.",
    "Tissue State Assessment: Learn to read the six tissue states (heat, cold, damp, dry, tension, laxity) and how they layer onto your constitutional baseline.",
    "Personalized Herb Matching: Input your current symptoms and receive herb suggestions filtered through your constitutional type \u2014 not generic recommendations, but personalized matches.",
    "Formulation Principles: Learn how to combine herbs effectively for your constitution \u2014 which herbs lead, which support, and how to balance a formula.",
  ];
  for (const d of deeper) b.drawBullet(d);

  // ── CTA ──
  b.y -= 10;
  b.drawCTABlock(
    "Join the Beta Waitlist",
    "Be the first to access the Eden Apothecary app when it launches.",
    "EdenInstitute.health/app-waitlist"
  );

  // ── DISCLAIMER ──
  b.drawDisclaimer();
}

// ═══════════════════════════════════════════════════════
// SIMPLE GUIDE GENERATOR (for other 3 types, pending upgrade)
// ═══════════════════════════════════════════════════════

interface SimpleContent {
  title: string;
  subtitle: string;
  tagline: string;
  pattern: string;
  herbs: string;
  scripture: string;
  caution: string;
}

const simpleContents: Record<string, SimpleContent> = {
  "cold-damp": {
    title: "COLD / DAMP CONSTITUTION",
    subtitle: "The Phlegmatic Pattern",
    tagline: "You conserve energy, move slowly, and tend toward accumulation.",
    pattern: "Your body tends toward sluggishness, congestion, water retention, low metabolic drive, and heaviness. Under stress you may withdraw, feel foggy, gain weight easily, or struggle to initiate.",
    herbs: "Warming, moving, and drying herbs are your allies: Ginger (Zingiber officinale), Rosemary (Salvia rosmarinus), Elecampane (Inula helenium), Thyme (Thymus vulgaris), Prickly Ash (Zanthoxylum americanum).",
    scripture: "\"Whatever you do, work heartily, as for the Lord.\" \u2014 Colossians 3:23. Your constitution excels at endurance. The challenge is initiation. Herbal support for your type helps awaken and move \u2014 physically and spiritually.",
    caution: "Cooling, heavily moistening herbs long-term \u2014 excessive marshmallow, slippery elm used alone.",
  },
  "hot-damp": {
    title: "HOT / DAMP CONSTITUTION",
    subtitle: "The Sanguine Pattern",
    tagline: "You tend toward heat with accumulation \u2014 inflammation that doesn't fully resolve.",
    pattern: "Your body tends toward infection, inflammation with swelling, skin eruptions, liver congestion, and reactive responses. You may run warm but feel heavy or congested simultaneously.",
    herbs: "Cooling and moving herbs are your allies: Dandelion root (Taraxacum officinale), Burdock (Arctium lappa), Oregon Grape Root (Mahonia aquifolium), Cleavers (Galium aparine), Yellow Dock (Rumex crispus).",
    scripture: "\"Create in me a clean heart, O God.\" \u2014 Psalm 51:10. The Hot/Damp type often carries more than it can process \u2014 physically and emotionally. Herbs that support elimination and resolution are also an invitation to release.",
    caution: "Very warming and stimulating herbs that increase heat and circulation without supporting resolution.",
  },
  "cold-dry": {
    title: "COLD / DRY CONSTITUTION",
    subtitle: "The Melancholic Pattern",
    tagline: "You tend toward depletion \u2014 under-resourced and underbuilt.",
    pattern: "Your body tends toward deficiency: thin tissues, poor absorption, dryness without heat, anxiety with fatigue, fragility. You may feel depleted rather than imbalanced \u2014 the tank runs low.",
    herbs: "Nourishing, building, and warming herbs are your allies: Ashwagandha (Withania somnifera), Oat straw (Avena sativa), Hawthorn (Crataegus spp.), Licorice root (Glycyrrhiza glabra), Nettle (Urtica dioica).",
    scripture: "\"He gives strength to the weary and increases the power of the weak.\" \u2014 Isaiah 40:29. The Cold/Dry type is not broken \u2014 it is depleted. The work is restoration, not stimulation. Rest, nourishment, and rebuilding herbs are the path.",
    caution: "Stimulating, depleting, or strongly bitter herbs without nourishing support \u2014 long-term coffee, ephedra, excess bitters.",
  },
};

async function generateSimpleGuide(doc: PDFDocument, content: SimpleContent): Promise<void> {
  const b = new PDFBuilder(doc);
  await b.init();

  b.drawCoverPage(content.title, content.subtitle, content.tagline);

  b.newPage();
  b.drawSectionHeader("YOUR PATTERN");
  b.drawParagraph(content.pattern);

  b.drawSectionHeader("HERBAL ALLIES");
  b.drawParagraph(content.herbs);

  b.drawSectionHeader("A WORD FROM SCRIPTURE");
  b.drawScripture(content.scripture);

  b.drawSectionHeader("USE WITH CAUTION");
  b.drawParagraph(content.caution);

  b.drawDisclaimer();
}

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const validTypes = ['hot-dry', 'cold-damp', 'hot-damp', 'cold-dry'];

    if (!type || !validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: `Invalid type. Valid types: ${validTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const doc = await PDFDocument.create();
    doc.setTitle(`Constitutional Guide - The Eden Institute`);
    doc.setAuthor('The Eden Institute');

    if (type === 'hot-dry') {
      await generateHotDryGuide(doc);
    } else {
      await generateSimpleGuide(doc, simpleContents[type]);
    }

    const pdfBytes = await doc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Eden-Institute-${type}-constitution-guide.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err.message, err.stack);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
