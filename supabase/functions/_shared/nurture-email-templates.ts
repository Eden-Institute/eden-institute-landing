import { shopApothecaryCard } from './shop-cta.ts';

// ── Brand constants (Eden Institute) ──
// Exported so the at-signup welcome emails (welcome-email-templates.ts) share the palette.
export const BRAND = {
  bgOuter: '#F5F0E8',
  bgBody: '#FFFFFF',
  forest: '#2C3E2D',
  text: '#3D3832',
  gold: '#C5A44E',
  sage: '#5C7A5C',
  footerText: '#6B6560',
};

// ── Slug helper ──
export function toSlug(nickname: string): string {
  return nickname.replace(/^The /, '').toLowerCase().replace(/\s+/g, '-');
}

// ── Amazon affiliate tag ──
//
// Mirror of the React-side helper in src/lib/amazonKitUrls.ts. The Deno
// EF runtime can't share imports with the React app, so the tag value
// and the append helper are duplicated here. When Camila swaps to a
// custom Associates tag (post-tax-interview), update the constant in
// BOTH files in lockstep.
//
// Rationale for keeping AMAZON_URLS as a bare-URL constant: the
// canonical mapping documented in src/lib/amazonKitUrls.ts asks the EF
// mirror to stay byte-identical so the two tables can be diff-checked
// for drift. Applying the tag at consumption (rather than at
// constant-definition) preserves that property.
const AMAZON_AFFILIATE_TAG = 'mobile088c05e-20';

function withAffiliateTag(url: string): string {
  if (!url) return url;
  if (/[?&]tag=/.test(url)) return url; // idempotent
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}tag=${AMAZON_AFFILIATE_TAG}`;
}

// ── Data mappings ──
// Bare URLs — MUST stay in lockstep with src/lib/amazonKitUrls.ts.
// Affiliate tag is applied at consumption via withAffiliateTag().
const AMAZON_URLS: Record<string, string> = {
  'burning-bowstring': 'https://www.amazon.com/hz/wishlist/ls/3SVZB0BRV2IE3?ref_=wl_share',
  'open-flame': 'https://www.amazon.com/hz/wishlist/ls/1ELQEQ7OEN6V6?ref_=wl_share',
  'pressure-cooker': 'https://www.amazon.com/hz/wishlist/ls/QR7IKCJ9S89E?ref_=wl_share',
  'overflowing-cup': 'https://www.amazon.com/hz/wishlist/ls/23IQ93Z31QB8Z?ref_=wl_share',
  'drawn-bowstring': 'https://www.amazon.com/hz/wishlist/ls/2TK1B0LX1VFPS?ref_=wl_share',
  'spent-candle': 'https://www.amazon.com/hz/wishlist/ls/2Q5D53CU2ZW1L?ref_=wl_share',
  'frozen-knot': 'https://www.amazon.com/hz/wishlist/ls/7NTDELHCTNMO?ref_=wl_share',
  'still-water': 'https://www.amazon.com/hz/wishlist/ls/2OV04T0L7C1FA?ref_=wl_share',
};

// ── HTML helpers ──

/** Which list this email is FOR, which decides the "why am I getting this" footer line.
 *
 *  This exists because every lead-magnet email told homeschool subscribers
 *  "You're receiving this because you completed the Constitutional Assessment".
 *  They never took the quiz. The unsubscribe LIST was always correct (the magnet
 *  drains pass 'homeschool'); it was only the visible sentence that was wrong,
 *  which is worse than it sounds: a false provenance line is the first thing a
 *  recipient reads when deciding whether an email is legitimate. */
export type EmailProvenance = 'constitution' | 'back_to_eden' | 'homeschool' | 'preorder' | 'preorder_update' | 'preorder_notice' | 'order';

const PROVENANCE_LINE: Record<EmailProvenance, string> = {
  constitution: 'You&rsquo;re receiving this because you completed the Constitutional Assessment at edeninstitute.health.',
  back_to_eden: 'You&rsquo;re receiving this because you asked for the free chapter of Back to Eden at edeninstitute.health.',
  homeschool: 'You&rsquo;re receiving this because you requested a free week of Eden&rsquo;s Table from The Eden Institute.',
  preorder: 'You&rsquo;re receiving this because you placed a preorder at edeninstitute.health.',
  order: 'You&rsquo;re receiving this because you placed an order at edeninstitute.health.',
  preorder_update: 'You are receiving this because you placed a preorder at edeninstitute.health.',
  preorder_notice: 'You are receiving this because you placed a preorder at edeninstitute.health. This is a required notice about your order and is not marketing.',
};

/** The shared chrome every Eden Institute email wears: forest header with the gold
 *  wordmark, gold rules around a white body, and a forest footer. The footer ROWS are
 *  passed in so an email can keep its own footer wording (the at-signup welcome emails
 *  do) while wearing the same look. `shopCard` appends the Shop Medicinal Herbs card to
 *  the body. emailWrapper below is this shell with the standard footer; its output is
 *  byte-identical to what it was before the shell was extracted. */
export function emailShell(bodyContent: string, footerRows: string, opts: { shopCard?: boolean } = {}): string {
  const bodyTail = opts.shopCard ? '\n' + shopApothecaryCard() : '';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>The Eden Institute</title>
<style>
@media only screen and (max-width: 620px) {
  .email-body-cell { padding: 24px 20px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bgOuter};font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bgOuter};">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.bgBody};border:1px solid #E8E3DA;">
<!-- HEADER -->
<tr><td style="background-color:${BRAND.forest};padding:40px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:${BRAND.gold};text-transform:uppercase;">THE EDEN INSTITUTE</td></tr>
<tr><td align="center" style="padding:16px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:60px;border-top:1px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:14px;color:#FFFFFF;font-style:italic;">Back to Eden. Back to Truth.</td></tr>
</table>
</td></tr>
<!-- GOLD RULE -->
<tr><td style="background-color:${BRAND.bgBody};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<!-- BODY -->
<tr><td class="email-body-cell" style="background-color:${BRAND.bgBody};padding:32px 40px;">
${bodyContent}${bodyTail}
</td></tr>
<!-- GOLD RULE -->
<tr><td style="background-color:${BRAND.bgBody};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<!-- FOOTER -->
<tr><td style="background-color:${BRAND.forest};padding:30px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${footerRows}
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** `shopCard: false` drops the Shop Medicinal Herbs card for an email that promises
 *  nothing to buy (the lead tracks' day-2 teaching email, the refund note). */
export function emailWrapper(bodyContent: string, provenance: EmailProvenance = 'constitution', opts: { shopCard?: boolean } = {}): string {
  const footerRows = `<tr><td style="font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-align:center;">The Eden Institute</td></tr>
<tr><td style="text-align:center;padding-top:6px;"><a href="https://edeninstitute.health" style="font-family:Georgia,serif;font-size:13px;color:#FFFFFF;text-decoration:underline;">edeninstitute.health</a></td></tr>
<tr><td style="text-align:center;padding-top:14px;">
<a href="https://www.facebook.com/EdensTableHomeschoolCurriculum" style="font-family:Georgia,serif;font-size:12px;color:#FFFFFF;text-decoration:underline;">Facebook</a>
&nbsp;|&nbsp;
<a href="https://instagram.com/edenstablehomeschoolcurriculum" style="font-family:Georgia,serif;font-size:12px;color:#FFFFFF;text-decoration:underline;">Instagram</a>
&nbsp;|&nbsp;
<a href="https://pin.it/6AuiXypgA" style="font-family:Georgia,serif;font-size:12px;color:#FFFFFF;text-decoration:underline;">Pinterest</a>
</td></tr>
<tr><td style="text-align:center;padding-top:14px;font-family:Georgia,serif;font-size:13px;color:${BRAND.gold};font-style:italic;">Back to Eden. Back to Truth.</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;padding-top:16px;">${PROVENANCE_LINE[provenance]}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;padding-top:6px;">Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-decoration:underline;">Unsubscribe</a></td></tr>`;
  return emailShell(bodyContent, footerRows, { shopCard: opts.shopCard ?? true });
}

/** Transactional variant: same chrome, the right provenance line, and the marketing
 *  unsubscribe placeholder pointed at the site (a buyer cannot opt out of order or
 *  delay notices). Pick the footer by provenance rather than string-replacing the
 *  rendered sentence: the wrapper writes the apostrophe as &rsquo;, so a replacement
 *  keyed on a straight apostrophe silently never matches (it shipped the quiz footer
 *  on every preorder confirmation before 2026-09-03). */
export function emailWrapperTransactional(bodyContent: string, provenance: EmailProvenance): string {
  return emailWrapper(bodyContent, provenance).split('{{UNSUB_URL}}').join('https://edeninstitute.health');
}

export function goldDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

export function p(text: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}

export function heading(text: string): string {
  return `<h2 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;color:${BRAND.forest};margin:0 0 16px 0;font-weight:bold;">${text}</h2>`;
}

export function brandButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr><td align="center" style="background-color:${BRAND.forest};border-radius:8px;">
<a href="${url}" target="_blank" style="display:inline-block;background-color:${BRAND.forest};color:${BRAND.gold};font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;text-align:center;padding:14px 40px;border-radius:8px;line-height:24px;mso-line-height-rule:exactly;">${label}</a>
</td></tr>
</table>
</td></tr>
</table>`;
}

function link(text: string, url: string): string {
  return `<a href="${url}" style="color:${BRAND.sage};text-decoration:underline;">${text}</a>`;
}

export function signature(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:24px 0 4px 0;">Grace and health,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="https://edeninstitute.health" style="color:${BRAND.sage};text-decoration:underline;">edeninstitute.health</a></p>`;
}

function spacer(h = 8): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${h}px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

// Quiz Emails 1-4 (buildNurtureEmail1-4) were replaced 2026-10-15 by the approved quiz track in
// lead-track-templates.ts (buildQuizEmail1-3 + buildParentsEmail). Recover them from git history.

// ══════════════════════════════════════════════════════════════
// EMAIL 5 — Day 8 (conditional — only if NOT purchased course AND NOT purchased guide; the course check is history since 2026-10-14)
// ══════════════════════════════════════════════════════════════
export function buildNurtureEmail5(
  constitutionName: string,
  constitutionSlug: string,
): { subject: string; html: string } {
  // Apply Camila's Amazon Associates affiliate tag at the consumption point.
  // AMAZON_URLS stays bare (lockstep with src/lib/amazonKitUrls.ts table);
  // withAffiliateTag() appends ?tag=mobile088c05e-20 idempotently.
  const amazonUrl = withAffiliateTag(
    AMAZON_URLS[constitutionSlug] || AMAZON_URLS['frozen-knot'],
  );

  const body = `
${p("No pressure. Truly. Not everyone is ready to go deep, and that's okay. Herbs meet you where you are.")}
${p(`Based on your constitutional type (<strong>${constitutionName}</strong>), I've put together a curated herb kit on Amazon. These are the specific herbs that match your body's pattern.`)}
${brandButton(`Shop Your ${constitutionName} Starter Kit`, amazonUrl)}
${spacer(8)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background-color:${BRAND.bgOuter};border-left:3px solid ${BRAND.gold};">
<tr><td style="padding:16px 20px;">
<p style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};margin:0;line-height:1.6;"><em>These are affiliate links. I earn a small commission if you purchase through them. It costs you nothing extra. It helps me keep building Eden Institute.</em></p>
</td></tr>
</table>
${p("If and when you're ready to go deeper, my book <em>Back to Eden</em> is the place to start.")}
${p(`${link("See the book →", "https://edeninstitute.health/back-to-eden")}`)}
${signature()}`;

  return {
    subject: `Your ${constitutionName} starter herb kit, curated just for you`,
    html: emailWrapper(body),
  };
}


// ── Sprouts/Seedlings lead-magnet nurture (Phase 3.1.2) ──
const FACEBOOK_URL = 'https://www.facebook.com/EdensTableHomeschoolCurriculum';

function facebookButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center" style="background-color:${BRAND.gold};border-radius:10px;"><a href="${url}" target="_blank" style="display:inline-block;background-color:${BRAND.gold};color:${BRAND.forest};font-family:Georgia,serif;font-size:17px;font-weight:bold;text-decoration:none;text-align:center;padding:16px 44px;border-radius:10px;line-height:24px;mso-line-height-rule:exactly;letter-spacing:0.3px;">&#9826;&nbsp; ${label} &nbsp;&rarr;</a></td></tr></table><p style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};margin:10px 0 0 0;font-style:italic;">@EdensTableHomeschoolCurriculum</p></td></tr></table>`;
}

// Day 7: the Starter Unit offer. REPLACES buildMagnetWeek2Email.
//
// WHY THE OLD ONE IS GONE. Founder decision 2026-08-27: the free lead magnet drops
// from TWO weeks per band to ONE, so the paid nine-week Starter Unit has something to
// sell. Week 2 (Chamomile for Sprouts, Tulsi for Seedlings) is retired FROM THE OFFER.
// The PDFs stay exactly where they are in public/lead-magnets/, because founders-lock
// links six of them inside a one-time blast already delivered to 832 people on
// 2026-06-30 and removing the files would break those delivered emails.
//
// This slot was also the single biggest hole in the funnel: it used to hand over the
// last free download and then close on a Facebook teaser. The moment the free material
// ends is the natural moment to sell, and it sold nothing.
//
// 🔴 THE HONESTY CONSTRAINT THAT SHAPES THIS COPY. The FREE week 1 carries SIX
// components (Teacher's Guide, Notebook, Read-Aloud, Field, Recipe and Around the Table
// cards). The PAID $39 Starter Unit carries THREE (Teacher's Guide, Notebook,
// Read-Aloud) for six weeks, because the combined card files for weeks 1 to 6 do not
// exist yet. So the paid weeks have FEWER component types than the free week the reader
// is holding. That is not something to bury: a parent who buys and then opens week 2
// expecting cards has a refund conversation, not a surprise. Founder decision
// 2026-08-27 was to keep the free week generous and state the difference plainly, which
// is what the "what is and is not in it" paragraph below does. Do not soften it.
//
// BAND AWARENESS. Until 2026-09-23 there was no Seedlings Starter Unit, and the
// Seedlings variant sold the Sprouts one with the #older-kids argument. The Seedlings
// Starter Unit now exists (founder decision 2026-09-23, /starter/seedlings), so each
// band is offered its OWN nine weeks, with the same words and the band swapped. The
// Seedlings printed year went on sale 2026-09-24, so its "whole year" block links to
// its own buy box on /books (#seedlings), never to the Sprouts books.
export function buildStarterOfferEmail(firstName: string, band: 'sprouts' | 'seedlings'): { subject: string; html: string } {
  const isSprouts = band === 'sprouts';
  const week1Herb = isSprouts ? 'Lavender' : 'Elderberry';
  const bandName = isSprouts ? 'Sprouts' : 'Seedlings';
  const starterUrl = isSprouts
    ? 'https://edeninstitute.health/starter'
    : 'https://edeninstitute.health/starter/seedlings';

  const opening =
    p(`You have had your ${week1Herb} week for about a week now. If you taught it, I hope it was a good one. If it is still sitting in the printer queue, that is all right too.`) +
    p(`The question I get next, almost every time, is the same one: what comes after it?`);

  const offer =
    heading('The first nine weeks, ready now') +
    p(`The <strong>${bandName} Starter Unit</strong> is weeks 1 through 9, as an instant download for <strong>$39</strong>. It reaches your inbox in about a minute and it is yours to keep.`) +
    p(`<strong>What is in it, plainly.</strong> Nine weeks of the Teacher&rsquo;s Guide, nine weeks of the Student Notebook, and the Read-Aloud storybook that carries those weeks. Three things, complete, for all nine weeks.`) +
    p(`<strong>It is the same shape as the week you already have.</strong> The Teacher&rsquo;s Guide and the Notebook carry everything: the story, the lesson, the kitchen lab and the dinner-table questions are all on the page. Nothing extra to buy, print or hunt for.`) +
    brandButton('Start with weeks 1 through 9 · $39', starterUrl);

  // 2026-09-12, the print-first pivot: this block used to point at the kit
  // preorder and the $39 credit against it. The kit is off sale and the credit
  // is no longer advertised (still minted; see starter.astro). The whole year
  // now exists in print, so that is the second door.
  const wholeYear =
    goldDivider() +
    (isSprouts
      ? p(`If you already know you want the whole Sprouts year, it is finished and on paper: all thirty-six weeks in three printed books, $249, printed for you when you order and at your door in about two to three weeks. <a href="https://edeninstitute.health/books#buy" style="color:#1C3A2E;">Here it is</a>.`)
      : p(`If you already know you want the whole Seedlings year, it is finished and on paper: all thirty-six weeks in three printed books, $249, printed for you when you order and at your door in about two to three weeks. <a href="https://edeninstitute.health/books#seedlings" style="color:#1C3A2E;">Here it is</a>.`)) +
    p(`And if this is simply not the month for it, keep teaching ${week1Herb}. It is a whole week and it stands on its own.`);

  // 2026-09-24, the founder's start rule, one line each way: older children who
  // know the basics can go to Seedlings; a family new to herbs starts at Sprouts.
  const startRule = isSprouts
    ? p(`If you have children in grades 3 to 5 who already know the basics of herbs, they can go straight to <a href="https://edeninstitute.health/starter/seedlings" style="color:#1C3A2E;">Seedlings</a>, the next thirty-six plants.`)
    : p(`New to herbs? Even with a child in grades 3 to 5, most families start with <a href="https://edeninstitute.health/starter" style="color:#1C3A2E;">Sprouts</a>, because its thirty-six plants are the ones Seedlings builds on.`);

  const body = p(`Hi ${firstName},`) + opening + goldDivider() + offer + wholeYear + startRule + signature();

  return {
    subject: `What comes after ${week1Herb}`,
    html: emailWrapper(body, 'homeschool'),
  };
}

// ── Quiz 3-arc (runs AFTER the constitution drip; queue positions 5/6/7 at
// days 11/14/17). Bridges quiz-takers to: the Deep Dive, app + book,
// homeschool + Facebook. Day 11 also sold the Foundations class until the course
// was retired 2026-10-14; the book has its own day (14), so day 11 is the guide alone.
// 2026-09-25: the book page on this site replaced Amazon (founder: cut Amazon out).
const ARC_BOOK_ONE_URL = 'https://edeninstitute.health/back-to-eden?utm_source=email&utm_medium=nurture&utm_campaign=quiz_arc2';
const ARC_APP_URL = 'https://edeninstitute.health/apothecary/start';
// 2026-09-24: arc 3 names the two bands on sale and sends families to the band
// chooser and the free weeks, instead of a "K-12" line that read as all built.
const ARC_CHOOSE_BAND_URL = 'https://edeninstitute.health/homeschool#choose-band';
const ARC_FREEBIES_URL = 'https://edeninstitute.health/freebies';

// Day 11: the Deep-Dive Guide.
export function buildNurtureArc1(firstName: string, constitutionName: string, constitutionSlug: string): { subject: string; html: string } {
  const patternShort = constitutionName.replace(/^The /i, '');
  const body = `${p(`Hi ${firstName},`)}${p(`You&rsquo;ve spent two weeks getting to know your pattern, <strong>${constitutionName}</strong>. If you&rsquo;re ready to go further, here is the next step.`)}${goldDivider()}${heading('Your Deep-Dive Guide')}${p(`Your ${patternShort} pattern in full: all 10 matched herbs with actions, preparation methods, dosages, and safety notes, plus a caution list, lifestyle and nutrition guidance, and the Biblical framework for your constitution.`)}${brandButton(`Get Your ${patternShort} Deep-Dive Guide: $4.99`, `https://edeninstitute.health/go/deep-dive/${constitutionSlug}`)}${signature()}`;
  return { subject: 'Now you know your pattern. Go deeper', html: emailWrapper(body) };
}

// Day 14: the app + the book.
export function buildNurtureArc2(firstName: string, constitutionName: string, _constitutionSlug: string): { subject: string; html: string } {
  const patternShort = constitutionName.replace(/^The /i, '');
  const body = `${p(`Hi ${firstName},`)}${p(`Your pattern doesn&rsquo;t have to live in an inbox. Two ways to keep it close.`)}${goldDivider()}${heading('The Eden Apothecary app')}${p(`Pattern-aware herb guidance in your pocket: your ${patternShort} matched herbs, the full library, energetics and safety, all tied to your constitution. Free to start; Seed and Root unlock more depth when you want it.`)}${brandButton('Start Free in the App', ARC_APP_URL)}${goldDivider()}${heading('The book for your shelf')}${p(`When you&rsquo;d rather hold it in your hands, <em>Back to Eden</em> is the book behind everything we teach.`)}${brandButton('Get the Book', ARC_BOOK_ONE_URL)}${signature()}`;
  return { subject: 'Carry your pattern with you', html: emailWrapper(body) };
}

// Day 17: homeschool curriculum + Facebook.
export function buildNurtureArc3(firstName: string, _constitutionName: string, _constitutionSlug: string): { subject: string; html: string } {
  const body = `${p(`Hi ${firstName},`)}${p(`One last door, and this one&rsquo;s for your family.`)}${goldDivider()}${heading('Eden&rsquo;s Table, for your children')}${p(`Our Biblical-herbalism curriculum teaches children the bodies God designed and the plants He gave to tend them, woven through Scripture, science, and the rhythms of your own kitchen table. Two years are ready now: <strong>Sprouts</strong> for kindergarten through 2nd grade and <strong>Seedlings</strong> for grades 3-5, and <a href="${ARC_FREEBIES_URL}" style="color:#1C3A2E;">Week 1 of each is free</a>.`)}${brandButton('Find where your children start', ARC_CHOOSE_BAND_URL)}${goldDivider()}${heading('Come along for the ride')}${p(`I&rsquo;m building all of this in real time. Follow along on Facebook for the progress, the roadblocks, and the news as each new year opens. It&rsquo;s sweeter with you walking it alongside me.`)}${facebookButton('Follow the Journey on Facebook', FACEBOOK_URL)}${signature()}`;
  return { subject: 'For your table and your family', html: emailWrapper(body) };
}

// Day 14: the "come along for the ride" Facebook pitch. Band-agnostic.
// DORMANT since 2026-07-28 (see nurture-emails MAGNET_CHAIN_NEXT): nothing enqueues
// magnet position 3 any more. Kept so the tail can be re-enabled.
export function buildMagnetWeek3FacebookEmail(firstName: string): { subject: string; html: string } {
  const body = `${p(`Hi ${firstName},`)}${p(`By now you&rsquo;ve walked through your first week of Eden&rsquo;s Table around your own kitchen table. Before you go further, I wanted to step out from behind the curriculum for a moment and tell you the story underneath it.`)}${p(`For as long as I can remember, I&rsquo;ve wanted to build something of my own. But it wasn&rsquo;t until late last year that God finally made it clear <em>what</em> that something should be: this. A Christ-centered way to teach our children the bodies He designed and the plants He gave to tend them.`)}${p(`This is a true passion project for me, and watching it come to life has been humbling in the best way. The encouragement and the sheer number of families asking for this curriculum have been such a blessing, far more than I expected.`)}${goldDivider()}${heading('Come along for the ride.')}${p(`I&rsquo;d love for you to follow the journey as I build this in real time. I&rsquo;ll be posting often on our Facebook page: the progress, the roadblocks, the honest struggles, and the praise reports along the way. It&rsquo;s the behind-the-scenes of a dream being built, and it&rsquo;s so much sweeter with you walking it alongside me.`)}${facebookButton('Follow the Journey on Facebook', FACEBOOK_URL)}${goldDivider()}${heading('Know a family who&rsquo;d love this?')}${p(`If a friend comes to mind, maybe another homeschool mom, a family at church, or someone who wants to raise their children close to God&rsquo;s creation, would you forward this email to them, or share the page? Word of mouth from families like yours is how Eden&rsquo;s Table grows.`)}${p(`<strong>One thing worth saying plainly,</strong> because I think it has quietly cost families time: there is no waiting list to join and no date to watch for. The whole Sprouts year is finished and printed to order, three books, at your door in about two to three weeks. And if you would rather start small, the first nine weeks are ready to download today for $39.`)}${brandButton('See the first nine weeks', 'https://edeninstitute.health/starter')}${signature()}`;
  return { subject: 'Come along for the ride', html: emailWrapper(body, 'homeschool') };
}
