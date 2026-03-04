import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PDFContent {
  title: string;
  tagline: string;
  pattern: string;
  herbs: string;
  scripture: string;
  caution: string;
}

const pdfContents: Record<string, PDFContent> = {
  "hot-dry": {
    title: "HOT / DRY CONSTITUTION",
    tagline: "You run warm, think fast, and burn through resources quickly.",
    pattern: "You tend toward inflammation, dryness, intensity, and heat. Under stress, you may experience irritability, insomnia, dry skin, constipation, and a sense of urgency that won't quiet.",
    herbs: "Cooling, moistening herbs are your allies: Marshmallow Root (Althaea officinalis), Lemon Balm (Melissa officinalis), Violet leaf (Viola odorata), Rose (Rosa spp.), Elderflower (Sambucus nigra).",
    scripture: "\"A tranquil heart gives life to the flesh.\" \u2014 Proverbs 14:30. Your constitution is built for intensity. But intensity without rest becomes combustion. The call on your life includes learning to dwell.",
    caution: "Stimulating, drying, or very pungent herbs used long-term \u2014 cayenne, ginger in excess, ephedra.",
  },
  "cold-damp": {
    title: "COLD / DAMP CONSTITUTION",
    tagline: "You conserve energy, move slowly, and tend toward accumulation.",
    pattern: "Your body tends toward sluggishness, congestion, water retention, low metabolic drive, and heaviness. Under stress you may withdraw, feel foggy, gain weight easily, or struggle to initiate.",
    herbs: "Warming, moving, and drying herbs are your allies: Ginger (Zingiber officinale), Rosemary (Salvia rosmarinus), Elecampane (Inula helenium), Thyme (Thymus vulgaris), Prickly Ash (Zanthoxylum americanum).",
    scripture: "\"Whatever you do, work heartily, as for the Lord.\" \u2014 Colossians 3:23. Your constitution excels at endurance. The challenge is initiation. Herbal support for your type helps awaken and move \u2014 physically and spiritually.",
    caution: "Cooling, heavily moistening herbs long-term \u2014 excessive marshmallow, slippery elm used alone.",
  },
  "hot-damp": {
    title: "HOT / DAMP CONSTITUTION",
    tagline: "You tend toward heat with accumulation \u2014 inflammation that doesn't fully resolve.",
    pattern: "Your body tends toward infection, inflammation with swelling, skin eruptions, liver congestion, and reactive responses. You may run warm but feel heavy or congested simultaneously.",
    herbs: "Cooling and moving herbs are your allies: Dandelion root (Taraxacum officinale), Burdock (Arctium lappa), Oregon Grape Root (Mahonia aquifolium), Cleavers (Galium aparine), Yellow Dock (Rumex crispus).",
    scripture: "\"Create in me a clean heart, O God.\" \u2014 Psalm 51:10. The Hot/Damp type often carries more than it can process \u2014 physically and emotionally. Herbs that support elimination and resolution are also an invitation to release.",
    caution: "Very warming and stimulating herbs that increase heat and circulation without supporting resolution.",
  },
  "cold-dry": {
    title: "COLD / DRY CONSTITUTION",
    tagline: "You tend toward depletion \u2014 under-resourced and underbuilt.",
    pattern: "Your body tends toward deficiency: thin tissues, poor absorption, dryness without heat, anxiety with fatigue, fragility. You may feel depleted rather than imbalanced \u2014 the tank runs low.",
    herbs: "Nourishing, building, and warming herbs are your allies: Ashwagandha (Withania somnifera), Oat straw (Avena sativa), Hawthorn (Crataegus spp.), Licorice root (Glycyrrhiza glabra), Nettle (Urtica dioica).",
    scripture: "\"He gives strength to the weary and increases the power of the weak.\" \u2014 Isaiah 40:29. The Cold/Dry type is not broken \u2014 it is depleted. The work is restoration, not stimulation. Rest, nourishment, and rebuilding herbs are the path.",
    caution: "Stimulating, depleting, or strongly bitter herbs without nourishing support \u2014 long-term coffee, ephedra, excess bitters.",
  },
};

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function generatePDF(category: string): Promise<Uint8Array> {
  const content = pdfContents[category];
  if (!content) throw new Error(`Unknown type: ${category}`);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${content.title} - The Eden Institute`);
  pdfDoc.setAuthor('The Eden Institute');
  pdfDoc.setSubject('Constitutional Type Guide');

  const page = pdfDoc.addPage([612, 792]);

  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const darkGreen = rgb(0.11, 0.227, 0.18);
  const gold = rgb(0.788, 0.659, 0.298);
  const cream = rgb(0.961, 0.941, 0.91);

  const pageWidth = 612;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  // Cream background
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 792, color: cream });

  // Dark green header
  const headerHeight = 100;
  page.drawRectangle({ x: 0, y: 792 - headerHeight, width: pageWidth, height: headerHeight, color: darkGreen });

  // Brand name
  const brandText = "THE EDEN INSTITUTE";
  const brandWidth = timesBold.widthOfTextAtSize(brandText, 11);
  page.drawText(brandText, { x: (pageWidth - brandWidth) / 2, y: 792 - 40, size: 11, font: timesBold, color: gold });

  // Gold divider
  page.drawLine({ start: { x: (pageWidth - 60) / 2, y: 792 - 52 }, end: { x: (pageWidth + 60) / 2, y: 792 - 52 }, thickness: 1, color: gold });

  // Tagline
  const headerTagline = "Back to Eden. Back to Truth.";
  const htWidth = timesItalic.widthOfTextAtSize(headerTagline, 10);
  page.drawText(headerTagline, { x: (pageWidth - htWidth) / 2, y: 792 - 70, size: 10, font: timesItalic, color: cream });

  let y = 792 - headerHeight - 30;

  // Title
  const titleWidth = timesBold.widthOfTextAtSize(content.title, 22);
  page.drawText(content.title, { x: (pageWidth - titleWidth) / 2, y, size: 22, font: timesBold, color: darkGreen });
  y -= 8;
  page.drawLine({ start: { x: margin + 80, y }, end: { x: pageWidth - margin - 80, y }, thickness: 1, color: gold });
  y -= 20;

  // Tagline
  const tagLines = wrapText(content.tagline, timesItalic, 12, contentWidth);
  for (const line of tagLines) {
    const lw = timesItalic.widthOfTextAtSize(line, 12);
    page.drawText(line, { x: (pageWidth - lw) / 2, y, size: 12, font: timesItalic, color: gold });
    y -= 16;
  }
  y -= 12;

  // Section helper
  function drawSection(label: string, body: string, yPos: number): number {
    page.drawText(label, { x: margin, y: yPos, size: 10, font: timesBold, color: gold });
    const labelW = timesBold.widthOfTextAtSize(label, 10);
    yPos -= 4;
    page.drawLine({ start: { x: margin, y: yPos }, end: { x: margin + labelW, y: yPos }, thickness: 0.5, color: gold });
    yPos -= 14;
    const lines = wrapText(body, timesRoman, 10, contentWidth);
    for (const line of lines) {
      page.drawText(line, { x: margin, y: yPos, size: 10, font: timesRoman, color: darkGreen });
      yPos -= 14;
    }
    yPos -= 10;
    return yPos;
  }

  y = drawSection("YOUR PATTERN", content.pattern, y);
  y = drawSection("HERBAL ALLIES", content.herbs, y);

  // Scripture with gold left border
  page.drawText("A WORD FROM SCRIPTURE", { x: margin, y, size: 10, font: timesBold, color: gold });
  const scrLabelW = timesBold.widthOfTextAtSize("A WORD FROM SCRIPTURE", 10);
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + scrLabelW, y }, thickness: 0.5, color: gold });
  y -= 14;
  const scriptureLines = wrapText(content.scripture, timesItalic, 10, contentWidth - 16);
  const scriptureHeight = scriptureLines.length * 14 + 4;
  page.drawRectangle({ x: margin, y: y - scriptureHeight + 14, width: 3, height: scriptureHeight, color: gold });
  for (const line of scriptureLines) {
    page.drawText(line, { x: margin + 12, y, size: 10, font: timesItalic, color: darkGreen });
    y -= 14;
  }
  y -= 10;

  y = drawSection("USE WITH CAUTION", content.caution, y);

  // Footer divider
  page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: gold });
  y -= 12;

  const disclaimer = "This guide is educational only and does not constitute medical advice. For complex or serious health concerns, consult a qualified practitioner. Learn more at EdenInstitute.health";
  const disclaimerLines = wrapText(disclaimer, timesItalic, 8, contentWidth);
  for (const line of disclaimerLines) {
    const dw = timesItalic.widthOfTextAtSize(line, 8);
    page.drawText(line, { x: (pageWidth - dw) / 2, y, size: 8, font: timesItalic, color: gold });
    y -= 11;
  }

  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');

    if (!type || !pdfContents[type]) {
      const validTypes = Object.keys(pdfContents).join(', ');
      return new Response(
        JSON.stringify({ error: `Invalid type. Valid types: ${validTypes}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pdfBytes = await generatePDF(type);
    const safeName = type;

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Eden-Institute-${safeName}-constitution-guide.pdf"`,
        'Cache-Control': 'public, max-age=86400',
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
