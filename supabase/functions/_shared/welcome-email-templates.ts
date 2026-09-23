// At-signup welcome emails sent by resend-waitlist: the Sprouts and Seedlings free
// week (edens_table funnel) and the homeschool waitlist welcome.
//
// Moved out of resend-waitlist/index.ts on 2026-09-15 (founder decision: "Match, test
// copies first") so they wear the same chrome as the day-7 Starter offer and the quiz
// emails: the shared emailShell, palette and paragraph, heading, button and divider
// helpers from nurture-email-templates.ts. Only the look changed. Every sentence,
// link, subject and footer line is the one these emails already carried, which is why
// they pass their own footer rows to emailShell instead of taking emailWrapper's
// standard footer (that one has different provenance wording and social links).
// welcome-email-templates.test.ts pins the wording. Voice rule: no em dashes.

import { BRAND, brandButton, emailShell, goldDivider, heading, p } from './nurture-email-templates.ts';

const POSTAL_ROW = `<tr><td style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;padding-top:6px;">Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043</td></tr>`;
const UNSUB_ROW = `<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-decoration:underline;">Unsubscribe</a></td></tr>`;

function footerRows(provenance: string, brandLine: string | null): string {
  const brand = brandLine
    ? `<tr><td style="font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-align:center;">${brandLine}</td></tr>\n`
    : '';
  const provenancePad = brandLine ? 16 : 0;
  return `${brand}<tr><td style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;padding-top:${provenancePad}px;">${provenance}</td></tr>
${POSTAL_ROW}
${UNSUB_ROW}`;
}

// Same styling as the shared signature(), with the words these emails always closed on.
function closingBlock(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:24px 0 4px 0;">We'll be in touch soon.</p>
<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>`;
}

// Consecutive download buttons: the shared brandButton, with the stack's outer margins
// tightened so three buttons read as one group rather than three sections.
function buttonStack(buttons: [string, string][]): string {
  return buttons
    .map(([label, url]) => brandButton(label, url).replace('style="margin:24px 0;"', 'style="margin:12px 0;"'))
    .join('\n');
}

function magnetWrapper(body: string): string {
  return emailShell(
    body,
    footerRows(
      "You're receiving this because you signed up at edeninstitute.health. No spam, ever.",
      'The Eden Institute | edeninstitute.health',
    ),
    { shopCard: true },
  );
}

export function buildHomeschoolEmail(firstName: string): { subject: string; html: string } {
  const body = `
${p(`Hi ${firstName},`)}
${p("You're on the list.")}
${p("Eden's Table is a K–12 Biblical herbalism curriculum being built for families who believe the earth was created with purpose, and that stewarding it well begins at home. You'll be among the first to see it, price it, and shape it.")}
${p('While we finish building, consider starting with our adult foundations course. Most of our homeschool families tell us it changed how they teach, because it changed how they understand.')}
${brandButton('Explore the Foundations Course', 'https://learn.edeninstitute.health/course/back-to-eden1')}
${goldDivider()}
${closingBlock()}`;
  return {
    subject: "You're on the Eden's Table Waitlist: Here's What's Coming",
    html: emailShell(body, footerRows("You're receiving this because you signed up at edeninstitute.health.", null)),
  };
}

export function buildSproutsMagnetEmail(firstName: string): { subject: string; html: string } {
  const body = `
${p(`Hi ${firstName},`)}
${p('Thank you for stepping into this work with us. What follows is a real week of curriculum: Week 1 of Sprouts, the band built for kindergarten through second grade. Not a sample stripped of substance. Five days with Lavender, a story your child will remember, and the small daily rhythms that turn a kitchen counter into a place of formation.')}
${goldDivider()}
${heading('YOUR THREE DOWNLOADS: SPROUTS WEEK 1 (LAVENDER)')}
${buttonStack([
    ['MEET THE FAMILY (READ-ALOUD)', 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-ra-lavender.pdf'],
    ["TEACHER'S GUIDE", 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-tg-lavender.pdf'],
    ['STUDENT NOTEBOOK', 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-nb-lavender.pdf'],
  ])}
${goldDivider()}
${heading('THIS IS A WHOLE WEEK')}
${p('Lavender is Week 1 of the curriculum exactly as it is taught. Five full days, the same pages families teach from all year, and it stands on its own. The printed card decks are not part of the free week; everything you need to teach these five days is in the guide and the notebook. Teach it whenever the week suits you. In about a week I will write again about the weeks that follow it, and there is nothing you need to do before then.')}
${closingBlock()}`;
  return { subject: 'Your Sprouts Week 1 (Lavender) is ready', html: magnetWrapper(body) };
}

export function buildSeedlingsMagnetEmail(firstName: string): { subject: string; html: string } {
  const body = `
${p(`Hi ${firstName},`)}
${p('Thank you for stepping into this work with us. What follows is a real week of curriculum from Seedlings, our band for third through fifth graders. Seedlings is built for the child who has begun to ask <em>why</em> and <em>how</em>, the one who has outgrown a worksheet and is ready to track a hypothesis across a week. Week 1 starts with Elderberry.')}
${goldDivider()}
${heading('YOUR THREE DOWNLOADS: SEEDLINGS WEEK 1 (ELDERBERRY)')}
${buttonStack([
    ["TEACHER'S GUIDE", 'https://edeninstitute.health/lead-magnets/hs-seedlings-w1-tg-elderberry.pdf'],
    ['STUDENT NOTEBOOK', 'https://edeninstitute.health/lead-magnets/hs-seedlings-w1-nb-elderberry.pdf'],
    ['STORY SEVEN: BE STILL (READ-ALOUD)', 'https://edeninstitute.health/lead-magnets/hs-seedlings-w2-ra-be-still.pdf'],
  ])}
${goldDivider()}
${heading('THIS IS A WHOLE WEEK')}
${p('Elderberry is Week 1 of the curriculum exactly as it is taught. Five full days, the same pages families teach from all year, and it stands on its own. The printed card decks are not part of the free week; everything you need to teach these five days is in the guide and the notebook. The read-aloud is a bonus: Story Seven, Be Still, the first story of the Seedlings year, which families read together in Week 2. Teach it whenever the week suits you. In about a week I will write again with what comes next, and there is nothing you need to do before then.')}
${closingBlock()}`;
  return { subject: 'Your Seedlings Week 1 (Elderberry) is ready', html: magnetWrapper(body) };
}
