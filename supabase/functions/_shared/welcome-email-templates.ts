// At-signup welcome emails sent by resend-waitlist: the Sprouts and Seedlings free
// week (edens_table funnel), the Eden's Table fallback welcome, and the
// Cultivators / Practitioners band waitlist welcome.
//
// Moved out of resend-waitlist/index.ts on 2026-09-15 (founder decision: "Match, test
// copies first") so they wear the same chrome as the day-7 Starter offer and the quiz
// emails: the shared emailShell, palette and paragraph, heading, button and divider
// helpers from nurture-email-templates.ts. Only the look changed. Every sentence,
// link, subject and footer line is the one these emails already carried, which is why
// they pass their own footer rows to emailShell instead of taking emailWrapper's
// standard footer (that one has different provenance wording and social links).
// welcome-email-templates.test.ts pins the wording. Voice rule: no em dashes.
// 2026-09-24, both elementary bands on sale: the homeschool welcome was rewritten
// (see buildHomeschoolEmail), each free-week email gained one start-rule line
// pointing to the other band, and the retired card-deck sentence came out.

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

// The Eden's Table fallback welcome: any edens_table signup that is not a free
// week or a band waitlist. Rewritten 2026-09-24. It used to say the curriculum was
// still being built, carried a waitlist subject, and sent families to the adult
// course. Both elementary years are on sale now, so it welcomes them to Eden's
// Table, gives the founder's start rule (web/components/BandChooser.astro) and
// links the free week, the band chooser and the printed years. Same chrome,
// closing and footer as before.
const LINK_STYLE = `color:${BRAND.forest};text-decoration:underline;`;
function link(text: string, url: string): string {
  return `<a href="${url}" style="${LINK_STYLE}">${text}</a>`;
}
const FREEBIES_URL = 'https://edeninstitute.health/freebies';

export function buildHomeschoolEmail(firstName: string): { subject: string; html: string } {
  const body = `
${p(`Hi ${firstName},`)}
${p("Welcome to Eden's Table. I am so glad you are here.")}
${p("Eden's Table is a Christ-centered homeschool herbalism curriculum, one plant a week, woven through Scripture, science and the rhythms of your own kitchen table. Two years are finished and ready now: <strong>Sprouts</strong> for kindergarten through second grade, and <strong>Seedlings</strong> for grades 3 to 5. They teach different plants, thirty-six each, so nothing repeats.")}
${p('Not sure where to start? Here is what I tell every family. Children in kindergarten through second grade start with Sprouts. Children in grades 3 to 5 who are new to herbs start with Sprouts too, because its plants are the ones Seedlings builds on. If they already know the basics, they can go straight to Seedlings. And if you have children in both, teach Sprouts to everyone together first.')}
${brandButton('See where to start', 'https://edeninstitute.health/homeschool#choose-band')}
${p(`${link('Week 1 of both years is free', FREEBIES_URL)}, if you would like to try before anything else. When you are ready for the whole year, it comes in three printed books, the Teacher&rsquo;s Guide, the Student Notebook and the Read-Aloud Storybook, all thirty-six weeks, for $249 plus flat $12 shipping: ${link('Sprouts', 'https://edeninstitute.health/books#buy')} or ${link('Seedlings', 'https://edeninstitute.health/books#seedlings')}.`)}
${goldDivider()}
${closingBlock()}`;
  return {
    subject: "Welcome to Eden's Table",
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
${p('Lavender is Week 1 of the curriculum exactly as it is taught. Five full days, the same pages families teach from all year, and it stands on its own. Everything you need to teach these five days is in the guide and the notebook. Teach it whenever the week suits you. In about a week I will write again about the weeks that follow it, and there is nothing you need to do before then.')}
${p(`If you have children in grades 3 to 5 who already know the basics of herbs, they can start with Seedlings, the next thirty-six plants. ${link('Its Week 1 is free too', FREEBIES_URL)}.`)}
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
${p('Elderberry is Week 1 of the curriculum exactly as it is taught. Five full days, the same pages families teach from all year, and it stands on its own. Everything you need to teach these five days is in the guide and the notebook. The read-aloud is a bonus: Story Seven, Be Still, the first story of the Seedlings year, which families read together in Week 2. Teach it whenever the week suits you. In about a week I will write again with what comes next, and there is nothing you need to do before then.')}
${p(`New to herbs? Even with a child in grades 3 to 5, most families start with Sprouts, because its thirty-six plants are the ones Seedlings builds on. ${link('Sprouts Week 1 is free too', FREEBIES_URL)}.`)}
${closingBlock()}`;
  return { subject: 'Your Seedlings Week 1 (Elderberry) is ready', html: magnetWrapper(body) };
}

// Cultivators (6-8) and Practitioners (9-12) waitlist welcome, 2026-09-24. Until
// then a band-waitlist signup got buildHomeschoolEmail, which calls the whole
// curriculum unbuilt and points at the adult course. The band descriptions are the
// /homeschool blurbs; the "start with Sprouts" turn is the founder's 2026-09-24
// direction. It promises only what is true: an email when the band has a date.
// Nothing about texts, because none are sent until the texting registration
// covers launch alerts.
const BAND_WAITLIST_COPY: Record<'cultivators' | 'practitioners', { name: string; grades: string; blurb: string }> = {
  cultivators: {
    name: 'Cultivators',
    grades: 'grades 6 to 8',
    blurb: 'Cultivators is the second pass at the 72 plants your child learns in Sprouts and Seedlings, this time through body patterns and terrain: why the same plant helps one person and not another, and how a garden becomes a remedy. It is planned for late 2027.',
  },
  practitioners: {
    name: 'Practitioners',
    grades: 'grades 9 to 12',
    blurb: 'Practitioners is the third pass at the 72 plants, at clinical depth. A high schooler who has grown up with these plants learns to reason about them the way a practitioner does. It is planned for 2028.',
  },
};

export function buildBandWaitlistEmail(firstName: string, band: 'cultivators' | 'practitioners'): { subject: string; html: string } {
  const c = BAND_WAITLIST_COPY[band];
  const body = `
${p(`Hi ${firstName},`)}
${p(`You are on the list for ${c.name}, our band for ${c.grades}. I will email you the moment it has a date.`)}
${p(c.blurb)}
${goldDivider()}
${heading('THE BEST WAY TO GET READY')}
${p(`Here is the part most families do not expect. ${c.name} goes back to the 72 plants your child meets in Sprouts and Seedlings, and goes deeper. So the best way to get ready is to start with those plants now. If herbs are new to your family, start with Sprouts, even with an older child. If your children already know the basics, Seedlings is the place.`)}
${brandButton('See where to start', 'https://edeninstitute.health/homeschool#choose-band')}
${p(`${link('Week 1 of both is free', FREEBIES_URL)}, if you would like to try before anything else.`)}
${closingBlock()}`;
  return { subject: `You are on the ${c.name} list`, html: magnetWrapper(body) };
}
